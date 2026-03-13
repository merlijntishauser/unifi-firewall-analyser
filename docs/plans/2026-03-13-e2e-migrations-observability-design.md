# End-to-End Confidence, Migrations, and Observability

Date: 2026-03-13
Status: Accepted
Roadmap item: 3. Add end-to-end confidence and upgrade safety

## Context

The app has strong unit coverage (98% Python, 95% TypeScript), strict lint/type gates, and 11 existing Playwright tests that mock the API at browser level. But three gaps remain:

- No end-to-end tests run against the production Docker image with a real backend.
- SQLite schema changes require users to delete their database.
- Logging is unstructured plain text with inconsistent event coverage.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| E2E data source | Mock UniFi controller | Exercises the full fetch-parse-analyze pipeline |
| E2E test suites | Keep both (mocked + production) | Different speeds, different purposes |
| Migration tool | Alembic | Future Postgres support planned |
| ORM | Full SQLAlchemy ORM | Clean migration autogeneration, single query layer |
| Initial migration | `CREATE TABLE IF NOT EXISTS` | Idempotent on fresh and existing DBs |
| Observability | structlog (JSON in prod, pretty in dev) | No infrastructure required, parseable by any aggregator |
| Prometheus metrics | Deferred to roadmap item 4 | Structured logging covers immediate needs |

## A. Production E2E Tests

### Mock controller

A small FastAPI app in `e2e/mock_controller/` (~100 lines) serving static JSON for the 5 endpoints that unifi-topology calls:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | Return 200 with session cookie |
| `GET /v2/api/site/default/firewall/zone` | Zone definitions |
| `GET /v2/api/site/default/firewall-policies` | Firewall rules |
| `GET /api/s/default/rest/firewallgroup` | Address/port groups |
| `GET /api/s/default/rest/networkconf` | Network/VLAN config |

Fixtures use the same zone/rule data from existing e2e fixtures, formatted as raw UniFi controller response envelopes.

### Docker Compose test stack

`docker-compose.e2e.yml` spins up:

1. **mock-controller** -- the mock FastAPI app
2. **app** -- the production image (from `Dockerfile`)
   - `UNIFI_URL=http://mock-controller:8000`
   - `UNIFI_USER=test`, `UNIFI_PASS=test`
   - `APP_PASSWORD=test`

### Playwright suite

`e2e/production.spec.ts` runs 6 journeys against `http://localhost:8080` (the production image). No API mocking at browser level.

| Journey | What it validates |
|---------|-------------------|
| Login flow | Credentials sent to backend, backend authenticates against mock controller, matrix loads |
| Matrix and graph navigation | Matrix renders zone pairs, cell click navigates to graph, back returns |
| Rule panel and findings | Open zone pair, see rules with static analysis findings and grades |
| Traffic simulation | Simulate traffic, get verdict from real simulator engine |
| Settings and AI config | Save AI provider config, verify persistence |
| App auth gate | APP_PASSWORD set, passphrase screen blocks until unlocked |

### CI integration

New `e2e-production` job in GitHub Actions, runs after the existing `docker-images` job (reuses the built image):

1. Start mock controller + production image via `docker-compose.e2e.yml`
2. Wait for health check
3. Run Playwright production suite
4. Upload trace artifacts on failure

Makefile: `make e2e-prod` for local runs. Existing `make e2e` unchanged.

## B. SQLAlchemy ORM + Alembic Migrations

### Models

New file `backend/app/models_db.py` with SQLAlchemy ORM models:

| Model | Table | Key |
|-------|-------|-----|
| `AiConfigRow` | `ai_config` | Singleton (id=1 check constraint) |
| `AiAnalysisCacheRow` | `ai_analysis_cache` | `cache_key` PK |
| `HiddenZoneRow` | `hidden_zones` | `zone_id` PK |
| `AiAnalysisSettingsRow` | `ai_analysis_settings` | Singleton (id=1 check constraint) |

Shared `Base = declarative_base()` and engine/session factory.

### Service refactor

Replace raw `sqlite3` calls in `ai_settings.py`, `zone_filter.py`, and `database.py` with SQLAlchemy sessions. Function signatures change from `db_path: Path` to `session: Session` (or use a session factory). Approximately 150 lines of SQL across 3 files.

### Alembic setup

Standard `alembic/` directory inside `backend/`:

- `env.py` configured against `Base.metadata` for autogenerate support
- `alembic.ini` with SQLite URL from `ANALYSER_DB_PATH`
- Initial migration uses `CREATE TABLE IF NOT EXISTS` for idempotency on existing databases

### Startup

`init_db()` in the FastAPI lifespan calls `alembic.command.upgrade(config, "head")` programmatically instead of running raw `CREATE TABLE` SQL. New databases get the full migration chain. Existing databases get the first migration applied cleanly.

### Migration testing

Pytest test in `tests/test_database.py`:

1. Create a pre-migration SQLite DB with raw `CREATE TABLE` matching old schema
2. Insert test data
3. Run `alembic upgrade head`
4. Verify tables, columns, and data survive

## C. Structured Logging

### Library

`structlog` wrapping stdlib logging.

### Configuration

In `main.py` lifespan, based on environment:

- **Production** (`FRONTEND_DIST_DIR` set): JSON output with timestamps
- **Development**: Colored console with key-value pairs

### Standard event fields

| Field | Where | Example |
|-------|-------|---------|
| `event` | Everywhere | `"unifi_fetch"`, `"ai_call"`, `"cache_lookup"` |
| `duration_ms` | Fetch, AI, simulation | `342` |
| `cache_hit` | AI analysis cache | `true` / `false` |
| `zone_count` | Controller fetch | `9` |
| `rule_count` | Controller fetch | `47` |
| `status` | AI calls, auth | `"success"`, `"timeout"`, `"error"` |
| `provider` | AI calls | `"openai"`, `"anthropic"` |
| `error` | Any failure | `"Connection refused"` |
| `schema_version` | Startup | `3` |

### Refactor scope

Replace `logging.getLogger(__name__)` with `structlog.get_logger()` across all routers and services. Change `logger.debug("message %s", arg)` to `log.info("event_name", field=value)`.

Startup banner stays as plain text (human-readable console output).

Single new dependency: `structlog`.

## Implementation order

1. **SQLAlchemy ORM + Alembic** -- foundational, other work depends on a working DB layer
2. **Structured logging** -- improves debugging for the e2e work that follows
3. **Mock controller + production e2e tests** -- validates the full stack including migrations and logging
4. **CI integration** -- wire it all into GitHub Actions

## Files changed

### New files

- `backend/app/models_db.py` -- SQLAlchemy ORM models
- `backend/alembic.ini` -- Alembic configuration
- `backend/alembic/env.py` -- Alembic environment
- `backend/alembic/versions/001_initial_schema.py` -- Initial migration
- `e2e/mock_controller/app.py` -- Mock UniFi controller
- `e2e/mock_controller/fixtures/` -- Raw controller response JSON
- `e2e/mock_controller/Dockerfile` -- Container for mock controller
- `docker-compose.e2e.yml` -- E2E test stack
- `frontend/e2e/production.spec.ts` -- Production e2e tests

### Modified files

- `backend/app/database.py` -- Replace raw SQL with SQLAlchemy engine/session, run Alembic on startup
- `backend/app/services/ai_settings.py` -- Replace sqlite3 with SQLAlchemy sessions
- `backend/app/services/zone_filter.py` -- Replace sqlite3 with SQLAlchemy sessions
- `backend/app/services/ai_analyzer.py` -- Replace sqlite3 cache calls with SQLAlchemy sessions
- `backend/app/main.py` -- structlog configuration, updated lifespan
- `backend/app/routers/*.py` -- structlog migration
- `backend/app/services/*.py` -- structlog migration
- `.github/workflows/ci.yml` -- New e2e-production job
- `Makefile` -- New `e2e-prod` target
- `backend/pyproject.toml` -- Add sqlalchemy, alembic, structlog dependencies
