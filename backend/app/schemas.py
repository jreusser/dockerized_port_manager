import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator

from app.models import HealthStatus


class ServiceRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    port: int = Field(..., ge=1, le=65535)
    host: str = Field(default="localhost", max_length=255)
    health_path: str = Field(default="/health", max_length=255)
    check_interval_seconds: int = Field(default=30, ge=5, le=86400)
    description: Optional[str] = Field(default=None, max_length=1024)
    tags: Optional[List[str]] = Field(default=None)

    @validator("health_path")
    def health_path_must_start_with_slash(cls, v: str) -> str:
        if not v.startswith("/"):
            raise ValueError("health_path must start with /")
        return v


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    health_path: Optional[str] = Field(default=None, max_length=255)
    check_interval_seconds: Optional[int] = Field(default=None, ge=5, le=86400)
    description: Optional[str] = Field(default=None, max_length=1024)
    tags: Optional[List[str]] = Field(default=None)
    active: Optional[bool] = None

    @validator("health_path")
    def health_path_must_start_with_slash(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith("/"):
            raise ValueError("health_path must start with /")
        return v


class ServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    port: int
    host: str
    health_path: str
    check_interval_seconds: int
    description: Optional[str]
    tags: Optional[List[str]]
    status: HealthStatus
    last_checked_at: Optional[datetime]
    last_healthy_at: Optional[datetime]
    consecutive_failures: int
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_model(cls, obj) -> "ServiceResponse":
        tags = None
        if obj.tags:
            tags = [t.strip() for t in obj.tags.split(",") if t.strip()]
        return cls(
            id=obj.id,
            name=obj.name,
            port=obj.port,
            host=obj.host,
            health_path=obj.health_path,
            check_interval_seconds=obj.check_interval_seconds,
            description=obj.description,
            tags=tags,
            status=obj.status,
            last_checked_at=obj.last_checked_at,
            last_healthy_at=obj.last_healthy_at,
            consecutive_failures=obj.consecutive_failures,
            active=obj.active,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


class HealthCheckEvent(BaseModel):
    service_id: uuid.UUID
    status: HealthStatus
    checked_at: datetime
    http_status_code: Optional[int]
    error: Optional[str]
