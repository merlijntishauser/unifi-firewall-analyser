# UniFi Firewall Analyser

Visualise your UniFi Network 9.x+ zone-based firewall rules as an interactive graph. Connect to your controller, see every zone as a node and every rule as an edge, then simulate traffic to understand which rule matches.

## What it does

- **Zone matrix** -- overview of all zone-to-zone rule relationships at a glance
- **Interactive graph** -- click a cell to explore zones and rules as a node graph with automatic layout
- **Rule inspector** -- click an edge to see every rule between two zones in a side panel
- **Traffic simulator** -- enter source/destination IP, protocol and port to see which rule would match
- **AI analysis** -- optional rule grading and risk assessment via OpenAI or Anthropic API
- **Dark mode** -- toggle between light and dark themes

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A UniFi Network controller running 9.x or later

### 1. Clone and configure

```bash
git clone https://github.com/merlijntishauser/unifi-firewall-analyser.git
cd unifi-firewall-analyser
cp .env.example .env
```

Edit `.env` with your controller details:

```env
UNIFI_URL=https://192.168.1.1     # your controller address
UNIFI_SITE=default                 # site name (usually "default")
UNIFI_USER=admin                   # controller username
UNIFI_PASS=yourpassword            # controller password
UNIFI_VERIFY_SSL=false             # set to true if you have a valid cert
```

All variables are optional -- you can also enter credentials at runtime through the UI.

### 2. Build and run

```bash
make build
make up
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

### 3. Stop

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

AI analysis is optional. You can configure an OpenAI or Anthropic API key in the Settings modal within the app.

## License

[MIT](LICENSE)
