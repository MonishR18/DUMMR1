from pydantic_settings import BaseSettings
from pydantic import ConfigDict, model_validator
from typing import Optional, List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://dummr_user:dummr_password@localhost:5433/dummr_db"
    REDIS_URL: Optional[str] = "redis://localhost:6380/0"
    
    SECRET_KEY: Optional[str] = None
    JWT_SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    ALLOWED_ORIGINS: Optional[str] = None
    CORS_ORIGINS: Optional[str] = "http://localhost:3000,http://localhost:5173"
    
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Email settings
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@dummr.com"
    
    # Storage settings
    STORAGE_PROVIDER: str = "local"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: Optional[str] = None
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    
    # Payment settings
    PAYMENT_PROVIDER: str = "razorpay"
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    model_config = ConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def sync_and_validate(self):
        # Sync SECRET_KEY and JWT_SECRET_KEY
        key = self.SECRET_KEY or self.JWT_SECRET_KEY or "supersecretkey12345supersecretkey12345"
        self.SECRET_KEY = key
        self.JWT_SECRET_KEY = key
        
        # Sync origins
        origins = self.ALLOWED_ORIGINS or self.CORS_ORIGINS or "http://localhost:3000,http://localhost:5173"
        self.ALLOWED_ORIGINS = origins
        self.CORS_ORIGINS = origins

        # Sync expire minutes/days
        if self.ACCESS_TOKEN_EXPIRE_MINUTES != 30:
            self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = self.ACCESS_TOKEN_EXPIRE_MINUTES
        if self.REFRESH_TOKEN_EXPIRE_DAYS != 7:
            self.JWT_REFRESH_TOKEN_EXPIRE_DAYS = self.REFRESH_TOKEN_EXPIRE_DAYS

        # Fail fast in production
        if self.ENVIRONMENT.lower() == "production":
            insecure_defaults = {"your_secret_key", "change_me_to_a_random_32_character_string_for_security", "supersecretkey12345supersecretkey12345"}
            if len(self.SECRET_KEY) < 32 or self.SECRET_KEY in insecure_defaults:
                raise ValueError("Insecure SECRET_KEY in production: must be at least 32 characters and cannot use default placeholders")

        return self

    @property
    def allowed_origins_list(self) -> List[str]:
        origins = self.ALLOWED_ORIGINS or self.CORS_ORIGINS or ""
        return [o.strip() for o in origins.split(",") if o.strip()]

settings = Settings()
