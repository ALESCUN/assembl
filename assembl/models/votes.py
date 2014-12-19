from abc import abstractproperty
from datetime import datetime

from sqlalchemy import (
    Column, Integer, ForeignKey, Boolean, String, Float, DateTime, and_)
from sqlalchemy.orm import relationship, backref

from . import (Base, DiscussionBoundBase, Tombstonable)
from .idea import Idea
from .auth import User
from ..auth import CrudPermissions, P_VOTE, P_SYSADMIN, P_ADMIN_DISC, P_READ
from .widgets import MultiCriterionVotingWidget
from ..semantic.virtuoso_mapping import QuadMapPatternS
from ..semantic.namespaces import (VOTE, ASSEMBL, DCTERMS)


class AbstractIdeaVote(DiscussionBoundBase, Tombstonable):
    __tablename__ = "idea_vote"

    id = Column(Integer, primary_key=True,
                info={'rdf': QuadMapPatternS(None, ASSEMBL.db_id)})

    type = Column(String(60), nullable=False)

    __mapper_args__ = {
        'polymorphic_identity': 'idea_graph_view',
        'polymorphic_on': 'type',
        'with_polymorphic': '*'
    }

    idea_id = Column(
        Integer,
        ForeignKey(Idea.id, ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        info={'rdf': QuadMapPatternS(None, VOTE.subject_node)}
    )
    idea = relationship(
        Idea,
        primaryjoin="and_(Idea.id==AbstractIdeaVote.idea_id, "
                    "Idea.is_tombstone==False)",
        backref=backref("votes", cascade="all, delete-orphan"))

    criterion_id = Column(
        Integer,
        ForeignKey(Idea.id, ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True,
        info={'rdf': QuadMapPatternS(None, VOTE.voting_criterion)}
    )
    criterion = relationship(
        Idea,
        primaryjoin="and_(Idea.id==AbstractIdeaVote.criterion_id, "
                    "Idea.is_tombstone==False)",
        backref="votes_using_this_criterion")

    vote_date = Column(DateTime, default=datetime.utcnow,
                       info={'rdf': QuadMapPatternS(None, DCTERMS.created)})

    voter_id = Column(
        Integer,
        ForeignKey(User.id, ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        info={'rdf': QuadMapPatternS(None, VOTE.voter)}
    )
    voter = relationship(User, backref="votes")

    def is_owner(self, user):
        return self.voter_id == user.id

    @classmethod
    def restrict_to_owners(cls, query, user_id=None):
        "filter query according to object owners"
        user_id = user_id or self.voter_id
        return query.filter(cls.voter_id == user_id)

    widget_id = Column(
        Integer,
        ForeignKey(MultiCriterionVotingWidget.id,
                   ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False)
    widget = relationship(
        MultiCriterionVotingWidget,
        primaryjoin="and_(MultiCriterionVotingWidget.id==AbstractIdeaVote.widget_id, "
                         "AbstractIdeaVote.is_tombstone==False)",
        backref="votes")

    def get_discussion_id(self):
        return self.idea.discussion_id

    @classmethod
    def get_discussion_conditions(cls, discussion_id, alias_maker=None):
        return ((cls.idea_id == Idea.id),
                (Idea.discussion_id == discussion_id))

    @classmethod
    def external_typename(cls):
        return "IdeaVote"

    @abstractproperty
    def value(self):
        pass

    crud_permissions = CrudPermissions(
        P_VOTE, P_ADMIN_DISC, P_SYSADMIN, P_SYSADMIN, P_VOTE, P_VOTE, P_READ)


class LickertRange(Base):
    __tablename__ = "lickert_range"
    rdf_class = VOTE.LickertRange

    id = Column(Integer, primary_key=True,
                info={'rdf': QuadMapPatternS(None, ASSEMBL.db_id)})

    minimum = Column(Integer,
                     info={'rdf': QuadMapPatternS(None, VOTE.min)})

    maximum = Column(Integer,
                     info={'rdf': QuadMapPatternS(None, VOTE.max)})

    @classmethod
    def get_range(cls, max=10, min=1):
        range = cls.db.query(cls).filter_by(minimum=min, maximum=max).first()
        if not range:
            range = cls(minimum=min, maximum=max)
            cls.db.add(range)
        return range


class LickertIdeaVote(AbstractIdeaVote):
    __tablename__ = "lickert_idea_vote"
    rdf_class = VOTE.LickertVote
    __mapper_args__ = {
        'polymorphic_identity': 'lickert_idea_vote',
    }
    id = Column(Integer, ForeignKey(
        AbstractIdeaVote.id,
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    range_id = Column(
        Integer,
        ForeignKey(LickertRange.id, ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        info={'rdf': QuadMapPatternS(None, VOTE.lickert_in_range)}
    )
    lickert_range = relationship(LickertRange)

    vote_value = Column(
        Float, nullable=False,
        info={'rdf': QuadMapPatternS(None, VOTE.lickert_value)})

    def __init__(self, **kwargs):
        if not ('lickert_range' in kwargs or 'range_id' in kwargs):
            kwargs['lickert_range'] = LickertRange.get_range()
        if 'value' in kwargs:
            # make sure lickert comes first
            if 'range_id' in kwargs:
                self.lickert_range = LickertRange.get_instance(
                    kwargs['range_id'])
            elif 'lickert_range' in kwargs:
                self.lickert_range = kwargs['lickert_range']
        super(LickertIdeaVote, self).__init__(**kwargs)

    @classmethod
    def external_typename(cls):
        return cls.__name__

    @property
    def value(self):
        return self.vote_value

    @value.setter
    def value(self, val):
        val = float(val)
        # assert val <= self.lickert_range.maximum and \
        #     val >= self.lickert_range.minimum
        self.vote_value = val


class BinaryIdeaVote(AbstractIdeaVote):
    rdf_class = VOTE.BinaryVote
    __tablename__ = "binary_idea_vote"
    __mapper_args__ = {
        'polymorphic_identity': 'binary_idea_vote',
    }

    id = Column(Integer, ForeignKey(
        AbstractIdeaVote.id,
        ondelete='CASCADE',
        onupdate='CASCADE'
    ), primary_key=True)

    vote_value = Column(
        Boolean, nullable=False,
        info={'rdf': QuadMapPatternS(None, VOTE.positive)})

    @classmethod
    def external_typename(cls):
        return cls.__name__

    @property
    def safe_value(self):
        return self.value

    @safe_value.setter
    def set_value_safe(self, val):
        assert val <= self.lickert_range.maximum and \
            val >= self.lickert_range.minimum
        self.value = val

    @property
    def value(self):
        return self.vote_value

    @value.setter
    def value_safe(self, val):
        self.vote_value = bool(val)
