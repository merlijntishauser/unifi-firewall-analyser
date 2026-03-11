# Contributing

Thanks for considering a contribution. This guide covers the development setup, architecture, and quality standards.

## Tech stack

| Layer    | Technology                                  |
|----------|---------------------------------------------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, XyFlow (React Flow) |
| Backend  | Python 3.13, FastAPI, Pydantic              |
| Data     | [unifi-topology](https://github.com/merlijntishauser/unifi-topology) library |
| Infra    | Docker Compose, Vite                        |

## Development setup

### With Docker (recommended)

```bash
cp .env.example .env          # configure controller credentials
make build
make up                        # api on :8001, frontend on :5174
```

Both services mount source code as volumes, so changes are reflected immediately (Vite HMR for frontend, uvicorn reload for backend).

### Without Docker

```bash
make backend-install           # uv sync in backend/
make frontend-install          # npm install in frontend/
```

## Project structure

```
backend/
  app/
    routers/        # API endpoints (auth, zones, rules, simulate, analyze, settings)
    services/       # Business logic (firewall, analyzer, simulator, ai)
    models.py       # Pydantic models
    config.py       # Environment configuration
    main.py         # FastAPI app entry point
  tests/            # Backend tests (pytest)

frontend/
  src/
    components/     # React components (ZoneGraph, ZoneMatrix, RulePanel, ...)
    utils/          # Shared utilities (layout, edgeColor)
    hooks/          # Custom React hooks
    api/            # API client and types
    App.tsx         # Root component

scripts/
  check-complexity.sh   # Radon + ESLint complexity checker
  ci-checks.sh          # Full CI pipeline
```

## Quality standards

Every PR must pass the full CI pipeline. Run it locally:

```bash
make ci
```

This runs:

| Check                | Command                                              |
|----------------------|------------------------------------------------------|
| Python lint          | `ruff check` + `ruff format --check`                 |
| Python types         | `mypy app/`                                          |
| Python tests         | `pytest` with coverage                               |
| TypeScript types     | `tsc --noEmit`                                       |
| TypeScript lint      | `eslint`                                             |
| TypeScript tests     | `vitest run` with coverage                           |
| Complexity           | Radon (Python) + ESLint (TypeScript)                 |

### Enforced thresholds

- Python test coverage: 98%
- TypeScript test coverage: 95%
- Cyclomatic complexity: max 15 per function
- Maintainability index: grade A

### Useful targets

```bash
make quality        # linters only (ruff, mypy, tsc, eslint)
make test           # tests only (pytest, vitest)
make complexity     # complexity checks only
make help           # list all available targets
```

## Workflow

1. Create a branch from `main`
2. Make your changes
3. Write or update tests -- new functions need unit tests
4. Run `make ci` and fix any issues
5. Open a pull request

Pre-commit hooks run the CI pipeline automatically on commit.

## Code conventions

- Python: formatted by Ruff, typed with mypy strict mode
- TypeScript: ESLint with max complexity 15, no `any` types
- Tests: colocated with source (frontend) or in `tests/` directory (backend)
- Commits: concise messages, no emoji

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
