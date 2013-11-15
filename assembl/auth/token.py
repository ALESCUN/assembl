# Lifted with thanks from
# https://github.com/okfn/annotator-store/blob/master/annotator/auth.py
import datetime

import iso8601
import jwt

DEFAULT_TTL = 86400


class TokenInvalid(Exception):
    pass


# Main auth routines

def encode_token(token, secret):
    token.update({'issuedAt': _now().isoformat()})
    return jwt.encode(token, secret)


def decode_token(token, secret='', ttl=DEFAULT_TTL, verify=True):
    try:
        token = jwt.decode(str(token), secret, verify=verify)
    except jwt.DecodeError:
        import sys
        exc_class, exc, tb = sys.exc_info()
        new_exc = TokenInvalid("error decoding JSON Web Token: %s" %
                               exc or exc_class)
        raise new_exc.__class__, new_exc, tb

    if verify:
        issue_time = token.get('issuedAt')
        if issue_time is None:
            raise TokenInvalid("'issuedAt' is missing from token")

        issue_time = iso8601.parse_date(issue_time)
        expiry_time = issue_time + datetime.timedelta(seconds=ttl)

        if issue_time > _now():
            raise TokenInvalid("token is not yet valid")
        if expiry_time < _now():
            raise TokenInvalid("token has expired")

    return token


def _now():
    return datetime.datetime.now(iso8601.iso8601.UTC).replace(microsecond=0)
