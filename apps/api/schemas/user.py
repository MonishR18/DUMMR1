from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator, field_validator
from typing import Optional, List
import re
from datetime import datetime

class UserBase(BaseModel):
    name: Optional[str] = None
    fullName: Optional[str] = None
    username: str
    email: EmailStr
    role: str = "CLIENT"
    specialty: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    college: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @model_validator(mode="after")
    def validate_name_and_role(self):
        if not self.name and not self.fullName:
            raise ValueError("Full name is required")
        if not self.name:
            self.name = self.fullName
        elif not self.fullName:
            self.fullName = self.name
        
        normalized_role = self.role.upper()
        if normalized_role not in ["CLIENT", "PROVIDER"]:
            raise ValueError("Role must be either CLIENT or PROVIDER")
        self.role = normalized_role
        return self

class UserUpdate(BaseModel):
    name: Optional[str] = None
    fullName: Optional[str] = None
    profile_image: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    expertise: Optional[str] = None
    specialty: Optional[str] = None
    college: Optional[str] = None

class PublicUserResponse(BaseModel):
    id: int
    name: str
    username: str
    role: str
    college: Optional[str] = None
    profile_image: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    expertise: Optional[str] = None
    specialty: Optional[str] = None
    rating: float = 0.0
    completed_orders: int = 0
    is_active: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PrivateUserResponse(PublicUserResponse):
    email: EmailStr
    is_verified: bool = False
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Alias for backward compatibility
UserResponse = PrivateUserResponse

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class RefreshToken(BaseModel):
    refresh_token: str

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
