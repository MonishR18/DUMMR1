# DUMMR1 — Independent Services Marketplace Platform

A production-ready, full-stack marketplace platform for independent service providers and clients (Fiverr-style freelance and campus services platform).

---

## 1. System Overview

- **Provider (Seller)**: Publishes service offerings with tiered packages (Basic, Standard, Premium), manages orders through a multi-stage fulfillment pipeline, communicates via threaded messaging, and tracks performance and revenue on the Seller Dashboard.
- **Client (Buyer)**: Explores and searches service listings with category & price filtering, places orders with custom project requirements, communicates in real time, pays via escrow, and reviews completed work.

---

## 2. Monorepo Structure

```
.
├── DUMMR_Services/           # React 19 SPA frontend (Create React App + React Router)
│   ├── src/                  # Modular components, contexts, and pages
│   ├── public/               # Static assets & SPA redirect configs (_redirects, vercel.json)
│   ├── Dockerfile            # Multi-stage production Nginx container
│   └── package.json          # Dependencies & scripts
│
├── apps/
│   ├── api/                  # FastAPI backend (SQLAlchemy 2, Alembic, Pydantic v2)
│   │   ├── api/routes/       # Endpoints: auth, services, orders, payments, storage, messaging
│   │   ├── core/             # Security, config, email, storage, rate limiting
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic v2 validation schemas
│   │   ├── alembic/          # Declarative database migrations
│   │   ├── tests/            # Automated test suite (19 passing pytest tests)
│   │   └── Dockerfile        # Production multi-worker Python 3.11 container
│   └── web/                  # Next.js web application
│
├── .github/workflows/        # Automated CI/CD workflows for backend & frontend
├── docker-compose.yml        # PostgreSQL 15, Redis 7, Backend API, and Frontend stack
├── DEPLOYMENT.md             # Comprehensive production deployment guide
└── README.md
```

---

## 3. Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ & npm
- Python 3.11+

### 1. Launch Database & Cache
```bash
docker compose up -d db redis
```

### 2. Run Backend API
```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_demo_data.py
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Run Frontend
```bash
cd DUMMR_Services
npm install
npm start
```
Frontend will be available at [http://localhost:3000](http://localhost:3000).

---

## 4. Pre-Seeded Demo Accounts

- **Provider**: `john.studio@dummr.services` / `Password123!`
- **Client**: `sarah.client@dummr.services` / `Password123!`

---

## 5. Deployment

Refer to [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full instructions on deploying to Render, Railway, Fly.io, Vercel, Netlify, or self-hosted Docker environments.
