#!/usr/bin/python
import sys
import signal

from threading import Thread, Event
from datetime import datetime, timedelta
from abc import ABCMeta, abstractmethod
import logging
from logging.config import fileConfig

from enum import Enum
from pyramid.paster import get_appsettings
from zope.component import getGlobalSiteManager
from kombu import BrokerConnection, Exchange, Queue
from kombu.mixins import ConsumerMixin
from kombu.utils.debug import setup_logging
import transaction

from assembl.tasks import configure
from assembl.lib.config import set_config


log = logging.getLogger('assembl')


class OrderedEnum(Enum):
    # As per enum34 recipe
    def __ge__(self, other):
        if self.__class__ is other.__class__:
            return self._value_ >= other._value_
        return NotImplemented
    def __gt__(self, other):
        if self.__class__ is other.__class__:
            return self._value_ > other._value_
        return NotImplemented
    def __le__(self, other):
        if self.__class__ is other.__class__:
            return self._value_ <= other._value_
        return NotImplemented
    def __lt__(self, other):
        if self.__class__ is other.__class__:
            return self._value_ < other._value_
        return NotImplemented


class ReaderStatus(OrderedEnum):
    # See doc/sourcereader.dot
    CREATED = 0
    READING = 1
    WAIT_FOR_PUSH = 2  # A state where new data will come without prompting
    PAUSED = 3  # A state where new data will come when prompted
    CLOSED = 4
    SHUTDOWN = 5
    TRANSIENT_ERROR = 10    # Try again later (same connection)
    CLIENT_ERROR = 11  # Make a new connection to re-try
    IRRECOVERABLE_ERROR = 12  # This server will never work.

disconnected_states = set((
        ReaderStatus.CLIENT_ERROR, ReaderStatus.IRRECOVERABLE_ERROR,
        ReaderStatus.CLOSED, ReaderStatus.SHUTDOWN))


# Connection constants
QUEUE_NAME = "source_reader"
ROUTING_KEY = QUEUE_NAME


class ReaderError(RuntimeError):
    status = ReaderStatus.TRANSIENT_ERROR
    pass


class ClientError(ReaderError):
    status = ReaderStatus.CLIENT_ERROR
    pass


class IrrecoverableError(ClientError):
    status = ReaderStatus.IRRECOVERABLE_ERROR
    pass


class SourceReader(Thread):
    """ """
    __metaclass__ = ABCMeta
    deamon = True

    # Timings. Those should vary per source type, maybe even by source?
    min_time_between_reads = timedelta(minutes=1)
    time_between_reads = timedelta(minutes=10)
    max_idle_period = timedelta(hours=3)

    transient_error_backoff = timedelta(seconds=10)
    transient_error_numlimit = 10
    client_error_backoff = timedelta(minutes=15)
    client_error_numlimit = 3
    irrecoverable_error_backoff = timedelta(days=1)

    def __init__(self, source_id):
        super(SourceReader, self).__init__()
        self.source_id = source_id
        self.status = ReaderStatus.CREATED
        self.last_prod = datetime.now()
        self.last_read = datetime.fromtimestamp(0)
        self.last_successful_read = datetime.fromtimestamp(0)
        self.last_successful_login = datetime.fromtimestamp(0)
        self.last_error_status = None
        self.last_error_time = None
        self.can_push = False  # Set to true for, eg, imap with polling.
        self.event = Event()

    def set_status(self, status):
        log.info("%s %d: %s -> %s" % (
            self.__class__.__name__, self.source_id, self.status.name,
            status.name))
        self.status = status

    def successful_login(self):
        self.last_successful_login = datetime.now()
        self.reset_errors()

    def successful_read(self):
        self.last_successful_read = datetime.now()
        self.reset_errors()

    def reset_errors(self):
        self.error_count = 0
        self.last_error_status = None
        self.last_error_time = None
        self.current_error_backoff = 0

    def new_error(self, status):
        if status != self.last_error_status:
            # Counter-intuitive, but either lighter or more severe errors
            # reset the count.
            self.error_count = 1
            self.last_error_status = status
            if status == ReaderStatus.TRANSIENT_ERROR:
                self.current_error_backoff = self.transient_error_backoff
            elif status == ReaderStatus.CLIENT_ERROR:
                self.current_error_backoff = self.client_error_backoff
            elif status == ReaderStatus.IRRECOVERABLE_ERROR:
                self.current_error_backoff = self.irrecoverable_error_backoff
            else:
                assert False
        elif status == self.last_error_status:
            self.error_count += 1
            if status == ReaderStatus.TRANSIENT_ERROR:
                if self.error_count > self.transient_error_numlimit:
                    self.last_error_status = ReaderStatus.CLIENT_ERROR
                    self.error_count = 1
                    self.current_error_backoff = self.client_error_backoff
                else:
                    self.current_error_backoff *= 2
            elif status == ReaderStatus.CLIENT_ERROR:
                if self.error_count > self.client_error_numlimit:
                    self.last_error_status = ReaderStatus.IRRECOVERABLE_ERROR
                    self.error_count = 1
                    self.current_error_backoff = \
                        self.irrecoverable_error_backoff
                else:
                    self.current_error_backoff *= 2
            elif status == ReaderStatus.IRRECOVERABLE_ERROR:
                self.current_error_backoff *= 2
            else:
                assert False
        self.last_error_time = datetime.now()

    def is_in_error(self):
        return self.last_error_status is not None

    def is_connected(self):
        return self.status not in disconnected_states

    def prod(self):
        if self.status in (ReaderStatus.PAUSED, ReaderStatus.CLOSED) and (
                datetime.now() - max(self.last_prod, self.last_read)
                > self.min_time_between_reads):
            self.event.set()
        elif self.status == ReaderStatus.TRANSIENT_ERROR and (
                datetime.now() - max(self.last_prod, self.last_error_status)
                > self.transient_error_backoff):
            # Exception: transient backoff escalation can be cancelled by prod
            self.event.set()
        self.last_prod = datetime.now()

    def run(self):
        self.setup()
        while self.status != ReaderStatus.SHUTDOWN:
            try:
                self.login()
                self.successful_login()
            except ReaderError as e:
                self.new_error(e.status)
                if self.status > ReaderStatus.TRANSIENT_ERROR:
                    self.do_close()
                self.event.wait(self.current_error_backoff.total_seconds())
                continue
            while self.is_connected():
                # Read in all cases
                try:
                    self.read()
                except ReaderError as e:
                    self.new_error(e.status)
                    if self.status > ReaderStatus.TRANSIENT_ERROR:
                        self.do_close()
                    self.event.wait(self.current_error_backoff.total_seconds())
                if not self.is_connected():
                    continue
                if self.can_push:
                    self.set_status(ReaderStatus.WAIT_FOR_PUSH)
                    while self.status == ReaderStatus.WAIT_FOR_PUSH:
                        try:
                            self.wait_for_push()
                        except ReaderError as e:
                            self.new_error(e.status)
                            if self.status > ReaderStatus.TRANSIENT_ERROR:
                                self.do_close()
                            else:
                                self.end_wait_for_push()
                            self.event.wait(self.current_error_backoff.total_seconds())
                            break
                        if not self.is_connected():
                            break
                        if self.status == ReaderStatus.READING:
                            self.set_status(ReaderStatus.WAIT_FOR_PUSH)
                        if self.status == ReaderStatus.PAUSED:
                            # If wait_for_push leaves us in PAUSED state,
                            # restart reading cycle
                            break
                    if not self.is_connected():
                        break
                    continue  # to next read cycle
                if not self.is_connected():
                    break
                if (self.last_successful_read - self.last_prod
                        > self.max_idle_period):
                    # Nobody cares, I can stop reading
                    try:
                        if self.status == ReaderStatus.WAIT_FOR_PUSH:
                            self.end_wait_for_push()
                    finally:
                        self.close()

                    if self.status != ReaderStatus.SHUTDOWN:
                        self.event.wait(0)
                else:
                    self.event.wait(self.time_between_reads.total_seconds())

    @abstractmethod
    def login(self):
        pass

    @abstractmethod
    def wait_for_push(self):
        # redefine in push-capable readers
        assert self.can_push
        # Leave a non-error status as either WAIT_FOR_PAUSE
        # or READING; the latter will loop.

    @abstractmethod
    def end_wait_for_push(self):
        # redefine in push-capable readers
        self.set_status(ReaderStatus.PAUSED)

    def close(self):
        if self.status == ReaderStatus.WAIT_FOR_PUSH:
            try:
                self.end_wait_for_push()
            except ReaderError as e:
                self.new_error(min(e.status, ReaderStatus.CLIENT_ERROR))
        self.set_status(ReaderStatus.CLOSED)
        try:
            self.do_close()
        except ReaderError as e:
            self.new_error(min(e.status, ReaderStatus.CLIENT_ERROR))

    @abstractmethod
    def do_close(self):
        pass

    def setup(self):
        from assembl.models import ContentSource
        self.source = ContentSource.get(self.source_id)

    def read(self):
        self.set_status(ReaderStatus.READING)
        self.do_read()
        self.successful_read()
        self.set_status(ReaderStatus.PAUSED)  # or WAIT_FOR_PUSH

    @abstractmethod
    def do_read(self):
        pass

    def shutdown(self):
        # TODO: lock.
        if self.is_connected():
            self.close()
        self.set_status(ReaderStatus.SHUTDOWN)
        self.event.set()


class PullSourceReader(Thread):
    # Simple reader, no wait for push, just redefine read

    def login(self):
        pass

    def wait_for_push(self):
        assert False, "This reader cannot wait for push"

    def end_wait_for_push(self):
        assert False, "This reader cannot wait for push"

    def do_close(self):
        pass



# Kombu communication. Does not work yet.

_exchange = Exchange(QUEUE_NAME)
_queue = Queue(
    QUEUE_NAME, exchange=_exchange, routing_key=ROUTING_KEY)
_producer_connection = None


def prod(source_id, force_restart=False):
    global _producer_connection
    from kombu.common import maybe_declare
    from kombu.pools import producers
    with producers[_producer_connection].acquire(block=True) as producer:
        maybe_declare(_exchange, producer.channel)
        producer.publish(
            [source_id, force_restart], serializer="json", routing_key=ROUTING_KEY)


def shutdown(source_id, force_restart=False):
    global _producer_connection
    from kombu.common import maybe_declare
    from kombu.pools import producers
    with producers[_producer_connection].acquire(block=True) as producer:
        maybe_declare(_exchange, producer.channel)
        producer.publish(
            [-1, None], serializer="json", routing_key=ROUTING_KEY)


class SourceDispatcher(ConsumerMixin):

    def __init__(self, connection):
        super(SourceDispatcher, self).__init__()
        self.connection = connection
        self.readers = {}

    def get_consumers(self, Consumer, channel):
        global _queue
        return [Consumer(queues=(_queue,),
                         callbacks=[self.callback])]

    def callback(self, body, message):
        source_id, force_restart = body
        if source_id > 0:
            self.read(source_id, force_restart)
        else:
            self.shutdown()
        message.ack()

    def read(self, source_id, force_restart=False):
        if source_id not in self.readers:
            from assembl.models import ContentSource
            source = ContentSource.get(source_id)
            reader = source.make_reader()
            self.readers[source_id] = reader
            if reader is None:
                return False
            if (reader.status != ReaderStatus.IRRECOVERABLE_ERROR
                    or force_restart):
                reader.start()
                return True
        reader = self.readers[source_id]
        if reader is None:
            return False
        if (reader.status != ReaderStatus.IRRECOVERABLE_ERROR
                or force_restart):
            reader.prod()
            return True
        return False

    def shutdown(self):
        for reader in self.readers.itervalues():
            reader.shutdown()


def includeme(config):
    global _producer_connection, _exchange
    setup_logging(loglevel='DEBUG')
    url = config.registry.settings.get('celery_tasks.imap.broker')
    _producer_connection = BrokerConnection(url)



if __name__ == '__main__':
    if len(sys.argv) != 2:
        print "usage: python source_reader.py configuration.ini"
    config_file_name = sys.argv[-1]
    settings = get_appsettings(config_file_name, 'assembl')
    registry = getGlobalSiteManager()
    registry.settings = settings
    set_config(settings)
    fileConfig(config_file_name)
    configure(registry, 'source_reader')
    url = settings.get('celery_tasks.imap.broker')
    signal.signal(signal.SIGTERM, shutdown)
    with BrokerConnection(url) as conn:
        sourcedispatcher = SourceDispatcher(conn)
        try:
            sourcedispatcher.run()
        except KeyboardInterrupt:
            sourcedispatcher.shutdown()
