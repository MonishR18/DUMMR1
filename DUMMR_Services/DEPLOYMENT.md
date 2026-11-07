# DUMMR Services — Production Deployment Guide

This guide provides end-to-end instructions for deploying **DUMMR Services** to production.

---

## 1. System Architecture

```mermaid
flowchart TD
    Client["Clients & Providers (Browser)"]
    CDN["Vercel / Netlify / Cloudflare (SPA Frontend)"]
    API["FastAPI Backend (Render / Railway / Fly.io / Docker)"]
    DB[("PostgreSQL 15 (Neon / Supabase / RDS)")]
    Redis[("Redis 7 (Upstash / Managed)")]
    S3["AWS S3 / Cloudinary (Media Storage)"]
    Payment["Razorpay / Stripe (Payments & Escrow)"]

    Client -->|HTTPS| CDN
    Client -->|REST API / Bearer JWT| API
    API -->|SQLAlchemy 2| DB
    API -->|Session & Rate Limiting| Redis
    API -->|Signed Uploads| S3
    Payment -->|Webhooks| API
```

---

## 2. Environment Variables

### Backend (`apps/api/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | `postgresql+psycopg2://user:pass@host:5432/db` |
| `ENVIRONMENT` | **Yes** | `production` | Set to `production` in live environments |
| `SECRET_KEY` | **Yes** | — | Min 32 random characters for JWT encoding |
| `JWT_SECRET_KEY` | **Yes** | — | Same as `SECRET_KEY` |
| `ALGORITHM` | No | `HS256` | JWT signature algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Access token lifespan |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifespan |
| `ALLOWED_ORIGINS` | **Yes** | — | Comma-separated CORS origins (e.g., `https://dummr.services`) |
| `FRONTEND_URL` | **Yes** | — | Base URL of frontend (e.g., `https://dummr.services`) |
| `REDIS_URL` | No | `redis://localhost:6380/0` | Optional Redis URL for caching & rate limiting |
| `SMTP_HOST` | No | — | SMTP server host (e.g., `smtp.sendgrid.net`) |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASSWORD` | No | — | SMTP password / API token |
| `EMAIL_FROM` | No | `noreply@dummr.services` | Verified sender address |
| `STORAGE_PROVIDER` | No | `local` | `local` or `s3` |
| `AWS_ACCESS_KEY_ID` | If S3 | — | AWS IAM Access Key |
| `AWS_SECRET_ACCESS_KEY` | If S3 | — | AWS IAM Secret Key |
| `AWS_REGION` | If S3 | `us-east-1` | AWS S3 Region |
| `AWS_S3_BUCKET` | If S3 | — | Bucket name for service media |
| `PAYMENT_PROVIDER` | No | `razorpay` | `razorpay` or `stripe` |
| `RAZORPAY_KEY_ID` | If Razorpay | — | Razorpay Public Key ID |
| `RAZORPAY_KEY_SECRET` | If Razorpay | — | Razorpay Secret Key for HMAC webhooks |
| `STRIPE_API_KEY` | If Stripe | — | Stripe Secret API Key |
| `STRIPE_WEBHOOK_SECRET` | If Stripe | — | Stripe Signing Secret for webhooks |

### Frontend (`DUMMR_Services/.env.production`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_API_URL` | **Yes** | Base URL of API backend (e.g., `https://api.dummr.services`) |

> **Security Note:** Never put database credentials, payment secrets, or private keys in the React frontend. Any variable prefixed with `REACT_APP_` is bundled into client-side JS and readable by anyone.

---

## 3. Database Migrations

DUMMR uses Alembic for declarative schema migrations.

### Apply Latest Migrations (Upgrade)
```bash
cd apps/api
alembic upgrade head
```

### Rollback One Revision (Downgrade)
```bash
cd apps/api
alembic downgrade -1
```

### Inspect Current Version
```bash
cd apps/api
alembic current
```

---

## 4. Deployment Option A: Cloud PaaS (Recommended)

### 1. Database (Neon / Supabase / RDS)
1. Provision a PostgreSQL 15+ database instance.
2. Note the direct connection string (must use `postgresql+psycopg2://` driver prefix).

### 2. Backend (Render / Railway / Fly.io)
1. Connect your Git repository.
2. Root Directory: `apps/api`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `./start.sh` (or `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`)
5. Configure all environment variables listed in Section 2.
6. Verify health check at `https://<api-domain>/health`.

### 3. Frontend (Vercel / Netlify / Cloudflare Pages)
1. Connect your Git repository.
2. Root Directory: `DUMMR_Services`
3. Framework Preset: `Create React App`
4. Build Command: `npm run build`
5. Output Directory: `build`
6. Environment Variable: `REACT_APP_API_URL=https://<api-domain>`
7. The included `public/_redirects` and `vercel.json` will automatically configure client-side SPA routing fallback to `/index.html`.

---

## 5. Deployment Option B: Self-Hosted Docker Compose

To run the entire stack on a single Linux VPS (Ubuntu 22.04 / 24.04):

```bash
# 1. Clone repository
git clone https://github.com/your-org/dummr.git
cd dummr

# 2. Copy and customize environment file
cp apps/api/.env.example apps/api/.env
nano apps/api/.env

# 3. Build and launch all containers
docker compose up -d --build

# 4. Check status
docker compose ps
docker compose logs -f api
```

The Docker container runs Alembic migrations automatically on startup via `start.sh` before booting the Uvicorn web workers.

---

## 6. Pre-Flight Production Checklist

- [ ] **Secret Key**: `SECRET_KEY` is at least 32 characters long and not a default.
- [ ] **HTTPS / SSL**: Both API and Frontend are served exclusively over HTTPS.
- [ ] **CORS**: `ALLOWED_ORIGINS` only includes the production frontend domain (`https://dummr.services`).
- [ ] **Payment Webhooks**: Webhook URL configured in Razorpay/Stripe dashboard pointing to `https://api.dummr.services/api/payments/webhook`.
- [ ] **Email Setup**: SMTP or transactional provider configured so password reset and verification emails send reliably.
- [ ] **Rate Limiting**: Verify SlowAPI rate limit headers are returned on auth routes.
- [ ] **Automated Backups**: Nightly pg_dump backups enabled on managed database.
