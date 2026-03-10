# Port Manager

A self-hosted service registry that tracks all the services running on your machine. Applications register themselves on startup via a single HTTP call, and Port Manager then periodically polls their `/health` endpoint, tracks status, and surfaces everything in a web dashboard.

## What it does

- **Service registration** — apps POST their name, port, and health path once on startup
- **Periodic health polling** — each service is polled on its own configurable interval (5 s – 24 h)
- **Status tracking** — `healthy` / `unhealthy` / `unreachable` / `unknown`, with consecutive failure counts and last-seen timestamps
- **Web dashboard** — filterable, auto-refreshing grid of all registered services at `http://localhost:8091`
- **REST API** — full CRUD at `http://localhost:9001/api/v1/services` with Swagger docs at `/docs`
- **Persistent** — PostgreSQL backend, survives container and host restarts
- **Journald logging** — status transitions are logged as structured output, captured by journald via Docker

---

## Stack

| Layer | Technology |
|---|---|
| API | Python 3.12, FastAPI, SQLAlchemy (async), asyncpg |
| Database | PostgreSQL 16 |
| Health poller | asyncio tasks (one per service) |
| Dashboard | React 18, TypeScript, PrimeReact, Redux Toolkit, webpack |
| Serving | nginx (serves frontend + proxies `/api` to backend) |
| Container | Docker Compose |
| Host service | systemd unit (`port-manager.service`) |

---

## Ports

| Port | Purpose |
|---|---|
| `9000` | Port Manager REST API |
| `8080` | Web dashboard |

---

## Production install (systemd)

```bash
# 1. Clone or copy this repo somewhere permanent
sudo cp -r . /opt/port-manager

# 2. Set your database password
sudo nano /opt/port-manager/.env

# 3. Run the installer
sudo ./install.sh
```

The installer:
- Copies files to `/opt/port-manager`
- Installs and enables `port-manager.service` via systemd
- Starts the stack immediately

```bash
# Useful commands after install
journalctl -u port-manager -f                    # service-level logs
journalctl CONTAINER_TAG=port-manager-backend -f # backend app logs
systemctl status port-manager
systemctl stop port-manager
systemctl start port-manager
```

---

## Local development

```bash
# Start everything (postgres + backend + frontend)
docker compose up --build

# Dashboard → http://localhost:8091
# API docs  → http://localhost:9001/docs
```

---

## Registering a service

POST to `http://localhost:9001/api/v1/services` from your application at startup.

```bash
curl -X POST http://localhost:9001/api/v1/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-api",
    "port": 8001,
    "host": "host.docker.internal",
    "health_path": "/health",
    "check_interval_seconds": 30,
    "description": "Main backend API",
    "tags": ["prod", "python", "api"]
  }'
```

| Field | Required | Default | Notes |
|---|---|---|---|
| `name` | ✅ | — | Human-readable label |
| `port` | ✅ | — | Must be unique in the registry |
| `host` | | `localhost` | Use `host.docker.internal` from inside containers |
| `health_path` | | `/health` | Must start with `/` |
| `check_interval_seconds` | | `30` | 5–86400 |
| `description` | | `null` | |
| `tags` | | `null` | Array of strings |

Registration is **idempotent** — re-posting an existing port re-activates it if it was previously deregistered.

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Port Manager's own health check |
| `GET` | `/api/v1/services` | List all services (`?active_only=true`) |
| `GET` | `/api/v1/services/{id}` | Get a single service |
| `POST` | `/api/v1/services` | Register a service |
| `PATCH` | `/api/v1/services/{id}` | Update name, path, interval, tags, active |
| `DELETE` | `/api/v1/services/{id}` | Soft-deregister (stops polling) |

Full interactive docs: `http://localhost:9001/docs`

---

## Integrating your apps

### FastAPI (Python)

```python
import asyncio, httpx, logging, os
from contextlib import asynccontextmanager
from fastapi import FastAPI

logger = logging.getLogger(__name__)
PORT_MANAGER_URL = os.getenv("PORT_MANAGER_URL", "http://localhost:9001/api/v1/services")

async def register_with_port_manager(name: str, port: int, **kwargs) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(PORT_MANAGER_URL, json={
                "name": name, "port": port,
                "host": "host.docker.internal",
                "health_path": "/health",
                "check_interval_seconds": 30,
                **kwargs,
            })
    except Exception as exc:
        logger.warning("Could not register with Port Manager: %s", exc)

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(register_with_port_manager("my-service", 8001, tags=["python"]))
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Express / Node.js (TypeScript)

```typescript
import axios from "axios";

const PORT_MANAGER_URL = process.env.PORT_MANAGER_URL ?? "http://localhost:9001/api/v1/services";

async function registerWithPortManager(): Promise<void> {
  try {
    await axios.post(PORT_MANAGER_URL, {
      name: "my-node-service",
      port: 3001,
      host: "host.docker.internal",
      health_path: "/health",
      check_interval_seconds: 30,
      tags: ["node"],
    }, { timeout: 5000 });
  } catch (err) {
    console.warn("Could not register with Port Manager:", err);
  }
}

app.listen(3001, () => { registerWithPortManager(); });
app.get("/health", (_req, res) => res.json({ status: "ok" }));
```

### Docker Compose (reaching Port Manager from a container)

```yaml
services:
  my-service:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      PORT_MANAGER_URL: "http://host.docker.internal:9001/api/v1/services"
```

---

## Port allocation conventions

Avoid conflicts by sticking to these ranges:

| Range | Purpose |
|---|---|
| `9000` | Port Manager API (reserved) |
| `8080` | Port Manager Dashboard (reserved) |
| `8001–8099` | Python / FastAPI services |
| `3000–3099` | Node.js / frontend dev servers |
| `5000–5099` | Miscellaneous / other languages |
| `9001–9099` | Internal tooling / admin |

Check what's already registered before picking a port:

```bash
curl -s http://localhost:9001/api/v1/services | jq '.[].port'
```

---

## Database migrations

Alembic is configured in `backend/`. To generate a new migration after a model change:

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

The initial schema migration (`0001`) runs automatically on first start via `init_db()`.

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + lifespan
│   │   ├── models.py          # SQLAlchemy Service model
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── database.py        # Async engine + session factory
│   │   ├── health_checker.py  # Asyncio polling engine
│   │   └── routers/
│   │       └── services.py    # CRUD endpoints
│   ├── alembic/               # Migration history
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   ├── types.ts
│   │   ├── api/services.ts    # Axios API client
│   │   ├── store/             # Redux slices + hooks
│   │   └── components/        # ServiceCard, ServiceList, RegisterDialog
│   ├── nginx.conf
│   ├── webpack.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .env                       # Credentials + port overrides
├── port-manager.service       # systemd unit
└── install.sh                 # One-shot production installer
```
