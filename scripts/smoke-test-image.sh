#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <image-tag> <container-name> <host-port>" >&2
    exit 1
fi

image_tag="$1"
container_name="$2"
host_port="$3"

cleanup() {
    docker rm -f "$container_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT

docker run -d --name "$container_name" -p "${host_port}:8080" "$image_tag" >/dev/null

for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{if .State.Running}}{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}{{else}}exited{{end}}' "$container_name")"

    if [ "$status" = "healthy" ]; then
        break
    fi

    if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ]; then
        docker logs "$container_name"
        echo "Container failed to become healthy" >&2
        exit 1
    fi

    sleep 1
done

final_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$container_name")"
if [ "$final_status" != "healthy" ]; then
    docker logs "$container_name"
    echo "Container did not become healthy in time" >&2
    exit 1
fi

health_response="$(curl --fail --silent --show-error "http://127.0.0.1:${host_port}/api/health")"
if [ "$health_response" != '{"status":"ok"}' ]; then
    echo "Unexpected health response: $health_response" >&2
    exit 1
fi

index_response="$(curl --fail --silent --show-error "http://127.0.0.1:${host_port}/")"
if ! grep -q "UniFi Firewall Analyser" <<<"$index_response"; then
    echo "Frontend root did not return expected HTML" >&2
    exit 1
fi
