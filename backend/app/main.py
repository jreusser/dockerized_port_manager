import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.health_checker import start_all_pollers, stop_all_pollers
from app.routers import services as services_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Port Manager starting — initialising database…")
    await init_db()
    await start_all_pollers()
    logger.info("Port Manager ready")
    yield
    logger.info("Port Manager shutting down…")
    await stop_all_pollers()


app = FastAPI(
    title="Port Manager",
    description="Service registry with HTTP health-check polling",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(services_router.router, prefix="/api/v1")


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
