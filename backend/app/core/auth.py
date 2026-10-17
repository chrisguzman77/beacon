"""Auth0 bearer tokens for people (platform guide 3.8). Machines use static X-Token values instead."""
import jwt
from fastapi import Depends, Header, HTTPException

from .config import settings

ROLE_CLAIM = "https://planit-beacon/role"
_jwks = None


def _client():
    global _jwks
    if _jwks is None:
        _jwks = jwt.PyJWKClient(f"https://{settings.auth0_domain}/.well-known/jwks.json")
    return _jwks


def get_user(authorization: str = Header("")):
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        key = _client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=settings.auth0_audience,
                            issuer=f"https://{settings.auth0_domain}/")
    except Exception as e:
        raise HTTPException(401, f"bad token: {e}")
    return {"sub": claims["sub"], "role": claims.get(ROLE_CLAIM, "crew")}


def require_supervisor(user=Depends(get_user)):
    if user["role"] != "supervisor":
        raise HTTPException(403, "supervisor only")
    return user
