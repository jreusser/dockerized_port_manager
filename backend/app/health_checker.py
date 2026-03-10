"""
Background health-check poller.

Each active service is polled independently on its own interval using asyncio.
When a service transitions to unhealthy / unreachable the event is logged to
stdout so journald can capture it (Docker --log-driver=journald or default json
picked up by journalctl).
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import HealthStatus, Service

logger = logging.getLogger("health_checker")

# Map service_id -> asyncio Task so we can cancel/reschedule on updates
_tasks: Dict[str, asyncio.Task] = {}


async def _check_once(service: Service, client: httpx.AsyncClient) -> tuple[HealthStatus, int | None, str | None]:
    """Perform a single HTTP health check. Returns (status, http_code, error)."""
    url = f"http://{service.host}:{service.port}{service.health_path}"
    try:
        resp = await client.get(url, timeout=10.0)
        if 200 <= resp.status_code < 300:
            return HealthStatus.HEALTHY, resp.status_code, None
        return HealthStatus.UNHEALTHY, resp.status_code, f"HTTP {resp.status_code}"
    except httpx.ConnectError:
        return HealthStatus.UNREACHABLE, None, "Connection refused"
    except httpx.TimeoutException:
        return HealthStatus.UNREACHABLE, None, "Timeout"
    except Exception as exc:  # noqa: BLE001
        return HealthStatus.UNREACHABLE, None, str(exc)


async def _poll_service(service_id: str) -> None:
    """Long-running task that polls a single service on its interval."""
    async with httpx.AsyncClient() as client:
        while True:
            async with AsyncSessionLocal() as db:
                service: Service | None = await db.get(Service, service_id)
                if service is None or not service.active:
                    logger.info("Service %s deregistered — stopping poller", service_id)
                    return

                interval = service.check_interval_seconds
                previous_status = service.status

                new_status, http_code, error = await _check_once(service, client)
                now = datetime.now(timezone.utc)

                service.status = new_status
                service.last_checked_at = now

                if new_status == HealthStatus.HEALTHY:
                    service.last_healthy_at = now
                    service.consecutive_failures = 0
                    if previous_status not in (HealthStatus.HEALTHY, HealthStatus.UNKNOWN):
                        logger.info(
                            "SERVICE RECOVERED  name=%s port=%d  (%s → healthy)",
                            service.name, service.port, previous_status.value,
                        )
                else:
                    service.consecutive_failures += 1
                    if previous_status == HealthStatus.HEALTHY or previous_status == HealthStatus.UNKNOWN:
                        logger.warning(
                            "SERVICE UNHEALTHY  name=%s port=%d  status=%s  error=%s  failures=%d",
                            service.name, service.port, new_status.value, error,
                            service.consecutive_failures,
                        )
                    else:
                        # Repeated failure - log at lower frequency to avoid spam
                        if service.consecutive_failures % 5 == 0:
                            logger.warning(
                                "SERVICE STILL UNHEALTHY  name=%s port=%d  status=%s  consecutive_failures=%d",
                                service.name, service.port, new_status.value,
                                service.consecutive_failures,
                            )

                await db.commit()

            await asyncio.sleep(interval)


def schedule_service(service_id: str) -> None:
    """Schedule (or reschedule) a poller task for the given service ID."""
    cancel_service(service_id)
    task = asyncio.create_task(_poll_service(service_id), name=f"poller:{service_id}")
    _tasks[service_id] = task
    task.add_done_callback(lambda t: _tasks.pop(service_id, None))


def cancel_service(service_id: str) -> None:
    """Cancel the poller task for a service if one exists."""
    task = _tasks.pop(service_id, None)
    if task and not task.done():
        task.cancel()


async def start_all_pollers() -> None:
    """On startup: load all active services from DB and start their pollers."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Service).where(Service.active == True))  # noqa: E712
        services = result.scalars().all()

    logger.info("Starting health pollers for %d active service(s)", len(services))
    for svc in services:
        schedule_service(str(svc.id))


async def stop_all_pollers() -> None:
    """On shutdown: cancel all running poller tasks."""
    ids = list(_tasks.keys())
    for sid in ids:
        cancel_service(sid)
    logger.info("All health pollers stopped")
