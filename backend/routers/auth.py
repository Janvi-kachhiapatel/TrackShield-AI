import os
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, AuditLog
from backend.schemas import LoginRequest, TokenResponse, UserResponse
from backend.security import (
    hash_password, verify_password, is_legacy_hash, issue_token, decode_token
)
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Demo mode keeps the sandbox user directory visible for the SIH demonstration.
# Set DEMO_MODE=false in production to hide the user list entirely.
DEMO_MODE = os.getenv("DEMO_MODE", "true").strip().lower() == "true"


def _user_response(user: User) -> UserResponse:
    dept_code = user.department.code if user.department else None
    dept_name = user.department.name if user.department else None
    return UserResponse(
        id=user.id,
        emp_id=user.emp_id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        department_code=dept_code,
        department_name=dept_name,
        is_active=user.is_active
    )


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Resolve the caller from a signed bearer token.

    Security: there is intentionally NO privileged fallback. A missing,
    malformed, expired, or unknown token always yields 401.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization[7:].strip()
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.emp_id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


def require_roles(*roles: str):
    """Dependency factory enforcing server-side role permissions."""
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions for this action")
        return current_user
    return checker


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.emp_id == req.emp_id.lower().strip()).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")

    # Transparently upgrade legacy SHA-256 hashes to salted PBKDF2.
    if is_legacy_hash(user.password_hash):
        user.password_hash = hash_password(req.password)

    db.add(AuditLog(
        user_id=user.id,
        user_name=user.name,
        role=user.role,
        action="USER_LOGIN",
        entity_type="AUTH",
        entity_id=user.emp_id,
        details=f"User {user.name} logged in successfully."
    ))
    db.commit()

    return TokenResponse(
        access_token=issue_token(user.emp_id, user.role),
        token_type="bearer",
        user=_user_response(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return _user_response(current_user)


@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """Sandbox directory for the hackathon demo. Hidden outside DEMO_MODE."""
    if not DEMO_MODE:
        raise HTTPException(status_code=404, detail="Not available")
    users = db.query(User).all()
    res = []
    for u in users:
        res.append({
            "emp_id": u.emp_id,
            "name": u.name,
            "role": u.role,
            "department_code": u.department.code if u.department else "ALL",
            "department_name": u.department.name if u.department else "All Departments"
        })
    return res