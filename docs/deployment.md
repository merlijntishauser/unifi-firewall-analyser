# Production Deployment

## Quick start

```bash
docker run -d \
  -p 8080:8080 \
  -v analyser-data:/data \
  -e APP_PASSWORD=your-secret-passphrase \
  -e AI_API_KEY=sk-your-api-key \
  -e AI_BASE_URL=https://api.openai.com/v1 \
  -e AI_MODEL=gpt-4o \
  ghcr.io/your-org/unifi-firewall-analyser:latest
```

## Environment variables

### Application auth

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PASSWORD` | _(empty)_ | When set, gates all API access behind a passphrase. When empty, no auth is enforced. |
| `APP_SESSION_TTL` | `86400` | Session cookie lifetime in seconds (default: 24 hours). |

### UniFi controller

| Variable | Default | Description |
|----------|---------|-------------|
| `UNIFI_URL` | _(empty)_ | UniFi controller URL (e.g. `https://192.168.1.1`). When set with user/pass, enables env-based auth (no login screen). |
| `UNIFI_USER` | _(empty)_ | UniFi controller username. |
| `UNIFI_PASS` | _(empty)_ | UniFi controller password. |
| `UNIFI_SITE` | `default` | UniFi site name. |
| `UNIFI_VERIFY_SSL` | `false` | Verify SSL certificate on controller connection. |

### AI provider

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_API_KEY` | _(empty)_ | AI provider API key (recommended for production). |
| `AI_API_KEY_FILE` | _(empty)_ | Path to a file containing the AI API key (for Docker secrets). `AI_API_KEY` takes priority if both are set. |
| `AI_BASE_URL` | _(empty)_ | AI provider base URL. |
| `AI_MODEL` | _(empty)_ | AI model name. |
| `AI_PROVIDER_TYPE` | `openai` | Provider type (`openai` or `anthropic`). |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `APP_ACCESS_URL` | `http://localhost:8080` | URL shown in the startup banner. |
| `PORT` | `8080` | Port the application listens on. |

## Docker Compose

```yaml
services:
  analyser:
    image: ghcr.io/your-org/unifi-firewall-analyser:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - analyser-data:/data
    environment:
      # App auth (optional)
      - APP_PASSWORD=your-secret-passphrase
      # UniFi controller (optional -- can also log in via the UI)
      - UNIFI_URL=https://192.168.1.1
      - UNIFI_USER=admin
      - UNIFI_PASS=changeme
      # AI provider (optional -- can also configure via Settings UI)
      - AI_API_KEY=sk-your-api-key
      - AI_BASE_URL=https://api.openai.com/v1
      - AI_MODEL=gpt-4o
      # - AI_PROVIDER_TYPE=openai

volumes:
  analyser-data:
```

## Docker Compose with secrets

For environments where environment variables are logged or visible in process listings, use Docker secrets for the AI API key:

```yaml
services:
  analyser:
    image: ghcr.io/your-org/unifi-firewall-analyser:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - analyser-data:/data
    environment:
      - APP_PASSWORD=your-secret-passphrase
      - AI_API_KEY_FILE=/run/secrets/ai_api_key
      - AI_BASE_URL=https://api.openai.com/v1
      - AI_MODEL=gpt-4o
    secrets:
      - ai_api_key

secrets:
  ai_api_key:
    file: ./secrets/ai_api_key.txt

volumes:
  analyser-data:
```

## Traefik reverse proxy

When running behind Traefik, both the frontend and API are served from the same origin. No CORS configuration is needed.

```yaml
services:
  analyser:
    image: ghcr.io/your-org/unifi-firewall-analyser:latest
    restart: unless-stopped
    volumes:
      - analyser-data:/data
    environment:
      - APP_PASSWORD=your-secret-passphrase
      - AI_API_KEY=sk-your-api-key
      - AI_BASE_URL=https://api.openai.com/v1
      - AI_MODEL=gpt-4o
      - APP_ACCESS_URL=https://firewall.example.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.analyser.rule=Host(`firewall.example.com`)"
      - "traefik.http.routers.analyser.entrypoints=websecure"
      - "traefik.http.routers.analyser.tls.certresolver=letsencrypt"
      - "traefik.http.services.analyser.loadbalancer.server.port=8080"
      - "traefik.http.services.analyser.loadbalancer.healthcheck.path=/api/health"
      - "traefik.http.services.analyser.loadbalancer.healthcheck.interval=30s"
    networks:
      - traefik

networks:
  traefik:
    external: true

volumes:
  analyser-data:
```

Key points:

- Traefik proxies all traffic (frontend + API) through one domain, so same-origin policy applies and no CORS headers are needed.
- The health check at `/api/health` is excluded from auth and always returns `200 OK`.
- Set `APP_ACCESS_URL` to your external domain so the startup banner shows the correct URL.
- TLS is handled by Traefik via Let's Encrypt -- the app itself serves plain HTTP on port 8080.

## Security notes

- **AI API keys**: In production, always use `AI_API_KEY` env var or `AI_API_KEY_FILE` (Docker secrets). The settings UI can still write keys to SQLite for local development, but a warning is logged at startup if `APP_PASSWORD` is set and a plaintext key exists in the database.
- **App auth**: When `APP_PASSWORD` is set, the app uses HMAC-signed session cookies (`httponly`, `samesite=strict`). The password is compared using constant-time comparison.
- **CORS**: The production image serves the frontend from the same origin as the API. CORS middleware is only active during development (when Vite runs on a separate port).
