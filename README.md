# AI-Powered Automatic Railway Maintenance & Block Planning System
### Indian Railways • Smart India Hackathon (SIH 2026) • Ministry of Railways

A full-stack, production-grade **Railway Maintenance Control Center** designed for fixed infrastructure coordination across Engineering (Track/TMS), Traction Distribution (Electrical/TDMS), Signalling (SMMS), and Telecommunications.

> **Data notice:** all operational data in this repository is **synthetic demonstration data**. No live railway systems are connected.

---

## 🌟 Key Architecture & Capabilities

### 1. Dual Persona Separation & Strict RBAC
* **Lower HOD Workspaces** (Electrical, Signal, Civil, Telecom, Mechanical):
  * Department-isolated dashboards, problem reporting wizard (4 steps) with live **AI Initial Assessment Preview**, execution tracking with live progress sliders (`0% -> 25% -> 50% -> 75% -> 100%`), delay reporting, and **Maintenance Completion Reports (MCR)**.
  * Strict authority boundary: Lower HOD cannot approve their own requests or close MCRs.
* **Higher HOD Command Center** (Head of All Departments):
  * Executive command dashboard with real-time database KPIs, interactive Corridor Status Visual Monitor, and Department Matrix.
  * **AI Block Planner** powered by constraint programming with **8-dimension Conflict Detection** (Train, Corridor, Time, Manpower, Resource, Safety, Isolation, Existing Block) and **Block Fusion** (achieving 50–66% reduction in corridor blockage).
  * Human-in-the-Loop decision controls: `APPROVE PLAN`, `MODIFY PLAN`, `REJECT PLAN` (with mandatory audit justification).
  * **Live Operations & Dynamic Re-planning**: Anomaly injection and on-the-fly schedule re-optimization.
  * **MCR Quality Verification Gate**: Close request, send for rework (mandatory instructions), or mark partial.
  * **Asset Risk Intelligence panel**: explainable 0–100 risk scores per asset (weighted health / age / criticality / inspection / open-work factors) with per-factor breakdowns and network-level distribution.
  * **Integration & Data Fabric panel**: published machine-readable interface contracts to existing railway systems (timetable inbound, asset condition inbound, possession advisory outbound, MCR return inbound).

### 2. Persistent Top-Right User Identity Rule
Every authenticated screen prominently displays:
* User Avatar & Full Name
* Role Badge (`HIGHER HOD` or `LOWER HOD • ELECTRICAL`)
* Department Scope (`All Departments` or `Electrical Department`)
* Profile Dropdown with Employee ID, Active status, and **1-Click Persona Quick-Switcher**
* Context Indicator ("You are here") below every page title

---

## 🚀 Quick Start Guide

### 1. Backend (FastAPI + OR-Tools / CP Constraint Engine + SQLite/PostgreSQL)
```powershell
# Navigate to workspace root
cd "d:\SIH 2026 2.0"

# (Optional) Re-seed realistic synthetic Indian Railways dataset:
python -m backend.seed_data

# Run FastAPI backend server:
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
* API Documentation: `http://127.0.0.1:8000/docs`
* Health Check: `http://127.0.0.1:8000/api/health`

> The backend auto-seeds the synthetic dataset on first boot if the database is empty — no manual seed step needed on cloud deploys.

### 2. Frontend (React 18 + TypeScript + Tailwind CSS + Lucide + Recharts)
```powershell
# In a new terminal:
cd "d:\SIH 2026 2.0\frontend"

# Launch development server:
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```
* Open in browser: **`http://127.0.0.1:5173`**

### 3. Deployment (full-stack demo with the real CP-SAT engine)

**Frontend → Vercel** (this repo's `vercel.json` already builds `frontend/dist`):
1. Import the GitHub repo in Vercel (root directory = repo root).
2. Optional env var: `VITE_API_URL=https://<your-backend-host>` (e.g. the Render URL below). Without it, the app runs in **offline demo mode** using the bundled synthetic dataset — login works, changes stay in the browser.

**Backend → Render** (blueprint included):
1. Render Dashboard → **New → Blueprint** → point at this repo. `render.yaml` provisions the free web service, installs `backend/requirements.txt`, starts uvicorn, and health-checks `/api/health`.
2. Set env vars on the service: `CORS_ORIGINS=https://<your-vercel-project>.vercel.app` and `TRACKSHIELD_SECRET_KEY` (`openssl rand -hex 32`).
3. On first boot the API auto-seeds the synthetic dataset (70 stations, 200 corridors, 400 assets, 500 trains, 200 requests).
4. Point the Vercel env var `VITE_API_URL` at the Render URL and redeploy — the amber "offline demo mode" banner disappears once `/api/health` answers.

> **Why a banner?** The frontend is transparent about its data source: a visible notice states when data is bundled/local-only versus served by the live engine. Login always requires valid credentials; there is no silent privileged session in either mode.

---

## 🔐 Security Model

* **Password hashing:** PBKDF2-HMAC-SHA256 with per-user random salt (200,000 iterations). Legacy unsalted SHA-256 demo hashes are transparently upgraded on the next successful login.
* **Session tokens:** HMAC-SHA256-signed expiring bearer tokens (12h default, configurable via `TOKEN_TTL_SECONDS`). Tokens are never the employee ID; payloads carry `sub`, `role`, `iat`, `exp`. Set `TRACKSHIELD_SECRET_KEY` in production so tokens survive restarts.
* **No privileged fallback:** a missing, malformed, expired, or unknown token always returns **401** — there is no automatic Higher-HOD session.
* **Server-side RBAC:** write authority (block approve/reject/modify, MCR verification, emergency re-optimization) is enforced by a `require_roles` dependency, not by the UI. Lower HODs receive **403** on privileged actions regardless of client state.
* **CORS allowlist:** explicit origin list via `CORS_ORIGINS`; wildcard origins disable credential support.
* **Demo mode:** the `/api/auth/demo-users` sandbox directory is only exposed while `DEMO_MODE=true` (default for the hackathon demo; set `false` in production).

---

## 🧠 Planning Engine — Computed, Not Asserted

The CP-SAT planner's reported metrics are derived from the data, not hard-coded:

| Metric | How it is computed |
|---|---|
| Maintenance window | Declared constants (default pre-dawn lull 01:00–05:00), documented in `ai_planner.py` |
| Train impact per block | Counted from actual timetable crossings inside the solved window (LOW / MEDIUM / HIGH) |
| Train delay estimate | Σ crossing trains × standard minimum delay; HIGH-priority trains weighted 2× |
| Asset availability | Share of HEALTHY assets on each scheduled corridor |
| Block reduction % | `1 − blocks/scheduled_jobs` across the generated plan |
| Risk scores | Weighted factor model in `risk.py` (health 35%, age 25%, criticality 20%, inspection 12%, open urgent work 8%) — every score ships with its factor breakdown |

### New API surfaces
* `GET /api/risk/assets` — risk-ranked asset register with factor breakdowns
* `GET /api/risk/summary` — network risk distribution and drivers
* `GET /api/risk/corridors` — aggregate asset risk per corridor
* `GET /api/data-fabric/adapters` — published integration contracts
* `GET /api/data-fabric/adapters/{key}/sample` — live sample per adapter
* `GET /api/data-fabric/status` — interface health board

---

## 👤 Official Demo Accounts

| Role | Name | Department | Employee ID | Password |
|---|---|---|---|---|
| **Higher HOD** | Keval Rana | Head of All Departments | `hod001` | `hod123` |
| **Lower HOD** | Rahul Patel | Electrical (TRD / OHE) | `elec001` | `elec123` |
| **Lower HOD** | Amit Shah | Signalling (SMMS) | `sig001` | `sig123` |
| **Lower HOD** | Rajesh Sharma | Civil Engineering (Track/TMS) | `civil001` | `civil123` |
| **Lower HOD** | Vikram Verma | Telecommunications | `tel001` | `tel123` |
| **Admin** | System Administrator | CRIS / Network Master Data | `admin001` | `admin123` |

---

## 📊 Synthetic Dataset Statistics
* **70 Indian Railway Stations**: Major junctions (NDLS, BCT, CNB, HWH, BPL, GZB, ALJN, etc.)
* **200 Corridors**: Double & quadruple trunk lines with speed and status tracking
* **400 Fixed Infrastructure Assets**: OHE cantilevers, insulators, point machines, track circuits, rail joints, OFC nodes
* **500 Train Schedules**: Rajdhani Express, Vande Bharat, Shatabdi, Superfast, and Freight paths
* **200 Maintenance Requests**: Realistic multi-status lifecycle records
* **100 Manpower Gangs & 100 Machinery Resources**: Tower inspection wagons, tamping machines, rail cranes

---

## 🏗️ Technology Stack
* **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React, Recharts, React Router v6, Axios
* **Backend**: FastAPI, Google OR-Tools CP-SAT / Railway Constraint Engine, SQLAlchemy ORM, Pydantic v2
* **Database**: SQLite (with WAL mode enabled) / Native PostgreSQL via `DATABASE_URL`

---

## 🎬 SIH Demo Script (5 minutes)

1. **Login** as `hod001 / hod123` (Higher HOD). If the amber "Offline demo mode" banner shows, the frontend is running without the backend — all features below still work against bundled data.
2. **AI Block Planner → Master Corridor Gantt** (top of page): pick a corridor, see trains (blue) vs maintenance blocks (gray/green) on a 24h timeline. Hover any bar for details.
3. **Single-Request Window Planner**: pick a request → *Generate Plan* → the engine scans 45+ candidate windows and shows the recommended window with **per-constraint counts** (train/resource/manpower/block conflicts, safety PASS, operational impact), the **timetable strip**, feasible vs rejected windows **with reasons**, and **WHY THIS PLAN**.
4. **AI Fusion Engine** (same page): expand a proposed fusion → *WHY THIS FUSION* reasons, candidate jobs, computed savings (blocks 3→1, occupation minutes) → *Apply Fusion* creates a real `FB-*` block (requires HOD authority; server re-validates constraints and refuses with explicit reasons if anything changed).
5. **Audit Timeline** (bottom of planner): the full lifecycle of a request from real audit rows.
6. **Approve flow**: Block Management → approve the fused block (Higher HOD only; Lower HOD gets 403 server-side).
7. **MCR Verification**: close/rework an MCR and watch the request status + asset status update.
8. **Dashboard**: KPIs, Asset Risk Intelligence (explainable factor breakdowns), Data Fabric (integration contracts), corridor monitor.

## ✅ How to verify everything yourself

**Backend (real engine):**
```bash
python -m uvicorn backend.main:app --reload          # auto-seeds on first boot
# open http://127.0.0.1:8000/docs — try:
# POST /api/ai/plan-request        {"request_id": 12}
# GET  /api/ai/fusion-opportunities
# POST /api/ai/apply-fusion        {"request_ids": [...]}   (needs HOD token)
# GET  /api/audit/timeline?request_id=12
# GET  /api/gantt/corridor/1
```
**Frontend:** `cd frontend && npm run dev` → http://localhost:5173
**Production:** https://track-shield-ai-theta.vercel.app/higher/ai-planner
**Connect the real backend:** deploy `render.yaml` (Render Blueprint), set `CORS_ORIGINS` + `TRACKSHIELD_SECRET_KEY`, then set `VITE_API_URL` in Vercel and redeploy. The demo banner disappears when `/api/health` answers.
