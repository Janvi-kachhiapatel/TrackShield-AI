import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend.routers import (
    auth, master, requests, ai_planner, blocks, mcr, live_ops, analytics,
    risk, data_fabric, planner, gantt, horizons
)

# Ensure tables exist
Base.metadata.create_all(bind=engine)

# Auto-seed the synthetic dataset when running against an empty database
# (fresh cloud deploys). Skipped when data already exists.
def _maybe_seed() -> None:
    from backend.database import SessionLocal
    from backend.models import Department
    db = SessionLocal()
    try:
        if db.query(Department).count() == 0:
            print("[INFO] Empty database detected - seeding synthetic dataset...")
            from backend.seed_data import seed_database
            seed_database()
    finally:
        db.close()

_maybe_seed()

app = FastAPI(
    title="TrackShield AI — Railway Asset & Possession Intelligence API",
    description=(
        "Coordination and optimization layer for railway maintenance: departmental "
        "work consolidation, possession planning, independent safety validation, "
        "and human-approved decision making. Synthetic demonstration data."
    ),
    version="3.0.0"
)

# CORS: explicit environment-specific origin allowlist.
# Configure with CORS_ORIGINS="https://app.example.com,https://admin.example.com".
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
allowed_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]
# Credentials are only safe with an explicit allowlist, never with "*".
allow_credentials = "*" not in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Mount API routers
app.include_router(auth.router)
app.include_router(master.router)
app.include_router(requests.router)
app.include_router(ai_planner.router)
app.include_router(blocks.router)
app.include_router(mcr.router)
app.include_router(live_ops.router)
app.include_router(analytics.router)
app.include_router(risk.router)
app.include_router(data_fabric.router)
app.include_router(planner.router)
app.include_router(gantt.router)
app.include_router(horizons.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "TrackShield AI — Railway Maintenance & Possession Planning",
        "planning_engine": "Google OR-Tools CP-SAT (constraint optimization)",
        "data_mode": "synthetic-demonstration",
        "version": "3.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)