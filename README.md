# DUMMR

DUMMR is a marketplace platform for independent service providers and clients (Fiverr-style freelance and campus services marketplace).

## Overview

The platform supports two primary user roles:
- **Provider (Seller)**: Publishes service offerings with tiered packages (Basic, Standard, Premium), manages orders through a fulfillment pipeline, and tracks performance on the Seller Dashboard.
- **Client (Buyer)**: Explores and searches service listings, places orders, communicates with providers via threaded messaging, and reviews completed work.

## Repository Structure

```
.
├── docker-compose.yml        # PostgreSQL 15 & Redis 7 services
├── apps/
│   ├── api/                  # FastAPI backend (SQLAlchemy 2, Alembic, Pydantic v2)
│   └── web/                  # Next.js web application
└── ../DUMMR_Services/        # React marketplace frontend application
```

## Backend Architecture (`apps/api`)

- **Framework**: FastAPI with asynchronous endpoints and Pydantic v2 schemas.
- **Database**: PostgreSQL with SQLAlchemy 2.0 ORM and Alembic migrations.
- **Cache & Token Store**: Redis for token revocation blocklists and view counting (with in-memory fallback).
- **Authentication**: Bcrypt password hashing, JWT access & refresh tokens, token revocation, role guards (`CLIENT`, `PROVIDER`, `ADMIN`), and email verification.
- **Rate Limiting**: SlowAPI rate limiting enabled on authentication and write endpoints.

## Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### 2. Start Services
Start the local PostgreSQL and Redis containers:
```bash
docker compose up -d
```
- PostgreSQL: `localhost:5433` (Database: `dummr_db`, User: `dummr_user`)
- Redis: `localhost:6380`

### 3. Setup the Backend API
```bash
cd apps/api
cp .env.example .env
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 4. Running Tests
```bash
cd apps/api
pytest -v
```

## Environment Variables

See [`apps/api/.env.example`](apps/api/.env.example) for all supported configuration options including database URLs, JWT secret keys, CORS origins, SMTP email settings, cloud storage (S3/Cloudinary), and payment gateways (Razorpay/Stripe).
