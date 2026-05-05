#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

APP_PORT="${APP_PORT:-3000}"
WS_PORT="${WS_PORT:-3100}"
DRAWBOARD_PORT="${DRAWBOARD_PORT:-3500}"
PID_FILE="${SCRIPT_DIR}/.dev-pids"

free_port() {
  local port="$1"
  local pids

  pids=$(lsof -ti tcp:"${port}" 2>/dev/null)
  if [ -z "${pids}" ]; then
    return
  fi

  echo "Closing existing process(es) on port ${port}: ${pids}"
  kill ${pids} 2>/dev/null || true
  sleep 1

  pids=$(lsof -ti tcp:"${port}" 2>/dev/null)
  if [ -n "${pids}" ]; then
    echo "Force killing stubborn process(es) on port ${port}: ${pids}"
    kill -9 ${pids} 2>/dev/null || true
  fi
}

if [ -f "${PID_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${PID_FILE}"
  kill "${WS_PID:-}" "${DRAWBOARD_PID:-}" "${APP_PID:-}" 2>/dev/null || true
fi

free_port "${APP_PORT}"
free_port "${WS_PORT}"
free_port "${DRAWBOARD_PORT}"

echo "Stopping database containers..."
docker compose stop db db-init

rm -f "${PID_FILE}"

echo "Local dev services stopped."
