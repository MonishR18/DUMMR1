import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from api.routes import (
    social,
    marketplace,
    auth,
    users,
    categories,
    services,
    packages,
    seller,
    orders,
    messaging,
    notifications,
    buyer,
    admin,
    reports,
    blocks,
    storage,
    payments,
)
from core.config import settings
from core.limiter import limiter

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT.lower() == "production":
        if len(settings.JWT_SECRET_KEY) < 32 or settings.JWT_SECRET_KEY == "your_secret_key":
            raise RuntimeError(
                "Insecure JWT_SECRET_KEY in production: must be at least 32 characters and cannot equal 'your_secret_key'"
            )
    yield

app = FastAPI(
    title="DUMMR API",
    description="Backend API for DUMMR campus social network and marketplace",
    version="1.0.0",
    lifespan=lifespan,
)

# SlowAPI Rate Limiting setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(services.router)
app.include_router(packages.router)
app.include_router(seller.router)
app.include_router(orders.router)
app.include_router(messaging.router)
app.include_router(notifications.router)
app.include_router(buyer.router)
app.include_router(admin.router)
app.include_router(social.router)
app.include_router(marketplace.router)
app.include_router(reports.router)
app.include_router(blocks.router)
app.include_router(storage.router)
app.include_router(payments.router)

# Mount local upload directory for static serving
uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to DUMMR API"}

@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "service": "DUMMR API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }
