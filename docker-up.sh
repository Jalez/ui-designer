#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

MODE="${1:-}"

is_production_env() {
  local env_value="${ENVIRONMENT:-${APP_ENV:-${NODE_ENV:-}}}"
  local normalized="${env_value,,}"
  [[ "${normalized}" == "production" || "${normalized}" == "prod" ]]
}

if [[ -z "${MODE}" ]] && is_production_env; then
  MODE="production"
fi

if [[ -z "${MODE}" ]] && [[ ! -f ".env.local" ]] && [[ -f ".env.production" ]]; then
  MODE="production"
fi

if [[ "${MODE}" == "production" || "${MODE}" == "prod" ]]; then
  shift
  COMPOSE_FILE="production.docker-compose.yml"
elif [[ "${MODE}" == "local" || "${MODE}" == "dev" ]]; then
  shift
  COMPOSE_FILE="docker-compose.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

if [[ "${1:-}" == "-f" || "${1:-}" == "--file" ]]; then
  if [[ $# -lt 2 ]]; then
    echo "Missing compose file after ${1}." >&2
    exit 1
  fi
  COMPOSE_FILE="${2}"
  shift 2
fi

CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-}"
if [[ -z "${CONTAINER_RUNTIME}" ]]; then
  if [[ "${COMPOSE_FILE}" == "production.docker-compose.yml" ]] && command -v podman >/dev/null 2>&1; then
    CONTAINER_RUNTIME="podman"
  elif command -v docker >/dev/null 2>&1; then
    CONTAINER_RUNTIME="docker"
  elif command -v podman >/dev/null 2>&1; then
    CONTAINER_RUNTIME="podman"
  else
    echo "No supported container runtime found. Install docker or podman." >&2
    exit 1
  fi
fi

ENV_ARGS=()
UP_ARGS=(up --build)

if [[ "${COMPOSE_FILE}" == "production.docker-compose.yml" ]]; then
  UP_ARGS+=(-d)
  if [[ -f ".env.production" ]]; then
    ENV_ARGS=(--env-file .env.production)
  fi
fi

COMPOSE_CMD=("${CONTAINER_RUNTIME}" compose)
if (( ${#ENV_ARGS[@]} > 0 )); then
  COMPOSE_CMD+=("${ENV_ARGS[@]}")
fi
COMPOSE_CMD+=(--file "${COMPOSE_FILE}" "${UP_ARGS[@]}")
if (( $# > 0 )); then
  COMPOSE_CMD+=("$@")
fi

exec "${COMPOSE_CMD[@]}"
