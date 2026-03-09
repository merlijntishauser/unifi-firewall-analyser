# UniFi Firewall Analyser

Web tool that visualises UniFi Network 9.x+ zone-based firewall rules as an interactive node graph.

Connect to a UniFi controller, see every zone as a node and every rule as an edge, then simulate traffic to understand which rule would match.

## Features

- **Zone graph** -- interactive node graph powered by React Flow, with automatic dagre layout
- **Rule inspector** -- click an edge to see all rules between two zones in a side panel
- **Traffic simulator** -- enter source/destination IP, protocol and port to see which rule would match
- **Dark mode** -- toggle between light and dark themes
- **Credential options** -- connect via environment variables or at runtime through the UI

## Tech stack

| Layer    | Technology                                 |
|----------|--------------------------------------------|
| Frontend | React, TypeScript, Tailwind CSS, React Flow |
| Backend  | Python 3.13, FastAPI, Pydantic              |
| Data     | [unifi-topology](https://github.com/merlijntishauser/unifi-topology) library |
| Infra    | Docker Compose, Vite                        |

## Quick start

### Docker Compose

```bash
cp .env.example .env        # edit with your controller details
make build
make up                      # api on :8001, frontend on :5174
```

### Local development

```bash
make backend-install         # uv sync in backend/
make frontend-install        # npm install in frontend/
```

## Environment variables

| Variable           | Description                  | Default   |
|--------------------|------------------------------|-----------|
| `UNIFI_URL`        | Controller URL               | --        |
| `UNIFI_SITE`       | Site name                    | `default` |
| `UNIFI_USER`       | Controller username          | --        |
| `UNIFI_PASS`       | Controller password          | --        |
| `UNIFI_VERIFY_SSL` | Verify SSL certificates      | `false`   |

All variables are optional when using runtime credentials via the UI.

## Quality

```bash
make ci       # run all checks locally (ruff, mypy, pytest, tsc, eslint, vitest, complexity)
make help     # list all available targets
```

Enforced thresholds:
- Python test coverage: 98%
- TypeScript test coverage: 95%
- Cyclomatic complexity: max 15
- Maintainability index: grade A

## License

MIT
