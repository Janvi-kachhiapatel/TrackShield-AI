"""
Security primitives for TrackShield AI.

- Password hashing: PBKDF2-HMAC-SHA256 with per-user salt (zero external deps).
  Legacy SHA-256 hashes from the original demo seed are still verified and are
  transparently upgraded to PBKDF2 on the next successful login.
- Session tokens: HMAC-SHA256 signed, expiring bearer tokens. The token payload
  carries the employee id and an expiry; it is NOT a raw employee id.

This module deliberately avoids third-party JWT/password libraries so the
hackathon stack (FastAPI + SQLite) stays dependency-light while removing the
two P0 issues: plain SHA-256 passwords and emp_id-as-bearer-token.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional, Dict, Any

PBKDF2_ITERATIONS = 200_000
PBKDF2_PREFIX = "pbkdf2_sha256"

# 12-hour sessions by default; override with TOKEN_TTL_SECONDS.
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", "43200"))

# In production set TRACKSHIELD_SECRET_KEY in the environment. If absent, a
# random key is generated per process (tokens are invalidated on restart,
# which is acceptable for the demo but must be fixed for production).
_SECRET_KEY = os.getenv("TRACKSHIELD_SECRET_KEY") or secrets.token_hex(32)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256 and a random salt."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def is_legacy_hash(stored: str) -> bool:
    """True when the stored hash is an old unsalted SHA-256 hex digest."""
    return bool(stored) and stored.startswith(PBKDF2_PREFIX) is False and len(stored) == 64


def verify_password(password: str, stored: str) -> bool:
    """
    Verify a password against a stored hash. Supports:
      - pbkdf2_sha256$iterations$salt$hash  (current scheme)
      - bare 64-char sha256 hex               (legacy demo data; upgrade on login)
    """
    if not stored:
        return False

    if stored.startswith(PBKDF2_PREFIX):
        try:
            _, iter_s, salt_hex, hash_hex = stored.split("$")
            iterations = int(iter_s)
            salt = bytes.fromhex(salt_hex)
            dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
            return hmac.compare_digest(dk.hex(), hash_hex)
        except (ValueError, AttributeError):
            return False

    if is_legacy_hash(stored):
        candidate = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(candidate, stored)

    return False


# ---------------------------------------------------------------------------
# Signed expiring bearer tokens
# ---------------------------------------------------------------------------

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def issue_token(emp_id: str, role: str) -> str:
    """Create an HMAC-signed bearer token bound to the employee and expiry."""
    now = int(time.time())
    payload = {
        "sub": emp_id,
        "role": role,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(_SECRET_KEY.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Validate signature and expiry; return the payload dict or None."""
    try:
        body, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(_SECRET_KEY.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_b64url_decode(body).decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(payload, dict) or "sub" not in payload:
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload