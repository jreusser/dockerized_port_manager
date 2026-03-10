import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.health_checker import cancel_service, check_all_now, schedule_service
from app.models import Service
from app.schemas import ServiceRegister, ServiceResponse, ServiceUpdate

router = APIRouter(prefix="/services", tags=["services"])


def _serialize(service: Service) -> ServiceResponse:
    return ServiceResponse.from_orm_model(service)


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def register_service(
    payload: ServiceRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Register a new service. Called by an application on first startup."""
    # Check for existing port registration
    existing = await db.execute(
        select(Service).where(Service.port == payload.port)
    )
    existing = existing.scalar_one_or_none()
    if existing:
        if existing.active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Port {payload.port} is already registered by '{existing.name}'",
            )
        # Re-activate a previously deregistered service on the same port
        existing.name = payload.name
        existing.host = payload.host
        existing.health_path = payload.health_path
        existing.check_interval_seconds = payload.check_interval_seconds
        existing.description = payload.description
        existing.tags = ",".join(payload.tags) if payload.tags else None
        existing.active = True
        existing.consecutive_failures = 0
        await db.commit()
        await db.refresh(existing)
        background_tasks.add_task(schedule_service, str(existing.id))
        return _serialize(existing)

    service = Service(
        name=payload.name,
        port=payload.port,
        host=payload.host,
        health_path=payload.health_path,
        check_interval_seconds=payload.check_interval_seconds,
        description=payload.description,
        tags=",".join(payload.tags) if payload.tags else None,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    background_tasks.add_task(schedule_service, str(service.id))
    return _serialize(service)


@router.post("/check-now", tags=["services"])
async def check_all_services_now():
    """Trigger an immediate health check on all active services."""
    count = await check_all_now()
    return {"checked": count}


@router.get("", response_model=List[ServiceResponse])
async def list_services(
    active_only: bool = True, db: AsyncSession = Depends(get_db)
):
    """List all registered services."""
    stmt = select(Service)
    if active_only:
        stmt = stmt.where(Service.active == True)  # noqa: E712
    result = await db.execute(stmt.order_by(Service.name))
    services = result.scalars().all()
    return [_serialize(s) for s in services]


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get a single service by ID."""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return _serialize(service)


@router.patch("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Update service metadata."""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    update_data = payload.dict(exclude_unset=True)
    if "tags" in update_data:
        tags = update_data.pop("tags")
        service.tags = ",".join(tags) if tags else None
    for field, value in update_data.items():
        setattr(service, field, value)

    await db.commit()
    await db.refresh(service)
    # Reschedule poller in case interval or active status changed
    if service.active:
        background_tasks.add_task(schedule_service, str(service.id))
    else:
        background_tasks.add_task(cancel_service, str(service.id))
    return _serialize(service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deregister_service(
    service_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Deregister (soft-delete) a service."""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.active = False
    await db.commit()
    background_tasks.add_task(cancel_service, str(service_id))
