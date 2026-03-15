# UniFi Homelab Ops

A self-hosted web application that extends the native UniFi dashboard with firewall analysis, network topology visualization, and device metrics monitoring. Connect to your controller and get deeper visibility into your UniFi network.

## What it does

- **Zone matrix** -- overview of all zone-to-zone rule relationships at a glance
- **Interactive graph** -- click a cell to explore zones and rules as a node graph with automatic layout
- **Rule inspector** -- click an edge to see every rule between two zones in a side panel
- **Traffic simulator** -- enter source/destination IP, protocol and port to see which rule would match
- **AI analysis** -- optional rule grading and risk assessment via OpenAI or Anthropic API
- **Dark mode** -- toggle between light and dark themes

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- A UniFi Network controller running 9.x or later

### Production image

Run the published single-container image:

```bash
docker run -d \
  --name unifi-homelab-ops \
  -p 8080:8080 \
  -v unifi-homelab-ops-data:/data \
  -e UNIFI_URL=https://192.168.1.1 \
  -e UNIFI_SITE=default \
  -e UNIFI_USER=admin \
  -e UNIFI_PASS=yourpassword \
  -e UNIFI_VERIFY_SSL=false \
  merlijntishauser/unifi-homelab-ops:latest
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

Notes:

- All `UNIFI_*` variables are optional. If omitted, log in through the UI after startup.
- Runtime UI credentials take priority over env vars until the container restarts.
- Mount `/data` to persist AI provider settings and cached AI analysis results.

### Development with Docker Compose

```bash
git clone https://github.com/merlijntishauser/unifi-homelab-ops.git
cd unifi-homelab-ops
cp .env.example .env
make build
make up
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

Stop the dev stack with:

```bash
make down
```

## Configuration

| Variable           | Description             | Default   |
|--------------------|-------------------------|-----------|
| `UNIFI_URL`        | Controller URL          | --        |
| `UNIFI_SITE`       | Site name               | `default` |
| `UNIFI_USER`       | Controller username     | --        |
| `UNIFI_PASS`       | Controller password     | --        |
| `UNIFI_VERIFY_SSL` | Verify SSL certificates | `false`   |
| `HOMELAB_OPS_DB_PATH` | SQLite database path | `/data/homelab-ops.db` in the production image |
| `APP_ACCESS_URL`   | URL shown in the production startup banner | `http://localhost:8080` |

AI analysis is optional. You can configure an OpenAI or Anthropic API key in the Settings modal within the app.

## Docker Hub publishing

The root [Dockerfile](./Dockerfile) builds the production single-container image. The workflow at [.github/workflows/docker-publish.yml](./.github/workflows/docker-publish.yml) builds multi-arch `linux/amd64` and `linux/arm64` images and pushes them to Docker Hub on pushes to `main` and version tags.

An experimental high-risk Alpine runtime prototype is available in [Dockerfile.alpine](./Dockerfile.alpine). CI now publishes it as `merlijntishauser/unifi-homelab-ops:alpine`. It is smaller, but uses `python:3.13-alpine` and `musl`, so dependency compatibility is less predictable than the main `slim` image.

The main CI workflow at [.github/workflows/ci.yml](./.github/workflows/ci.yml) also:

- builds the standard and Alpine images for `linux/amd64`
- smoke-tests container startup plus `/api/health` and `/`
- runs Trivy image scans for OS and library vulnerabilities
- fails on `HIGH` and `CRITICAL` findings, ignoring unfixed issues

To enable publishing, add these GitHub repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Pending upstream changes

- [ ] Add `model_name` field to `DeviceStats` in [unifi-topology](https://github.com/merlijntishauser/unifi-topology) so metrics cards show the friendly device name (e.g. "UniFi Cloud Gateway Fiber") instead of the model code (e.g. "UCGFIBER")

## License

[MIT](LICENSE)
