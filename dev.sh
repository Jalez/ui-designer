#!/bin/bash

set -euo pipefail

# dev.sh - Start local development environment with hot-reload

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

export WS_SERVICE_TOKEN="${WS_SERVICE_TOKEN:-ws-service-secret}"
export COLLAB_ENGINE="${COLLAB_ENGINE:-${NEXT_PUBLIC_COLLAB_ENGINE:-yjs}}"
export NEXT_PUBLIC_COLLAB_ENGINE="${NEXT_PUBLIC_COLLAB_ENGINE:-${COLLAB_ENGINE}}"
export WS_ARTIFICIAL_DELAY_MS="${WS_ARTIFICIAL_DELAY_MS:-80}"
export WS_ARTIFICIAL_JITTER_MS="${WS_ARTIFICIAL_JITTER_MS:-120}"
LOCAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hello_ui"
export DATABASE_URL="${LOCAL_DATABASE_URL}"
export DB_CLIENT="${DB_CLIENT:-postgres}"
APP_PORT="${APP_PORT:-3000}"
WS_PORT="${WS_PORT:-3100}"
DRAWBOARD_PORT="${DRAWBOARD_PORT:-3500}"
PID_FILE="${SCRIPT_DIR}/.dev-pids"

# Kill any existing listeners on the ports this script needs.
free_port() {
  local port="$1"
  local pids

  pids=$(lsof -ti tcp:"${port}" 2>/dev/null || true)
  if [ -z "${pids}" ]; then
    return 0
  fi

  echo "Closing existing process(es) on port ${port}: ${pids}"
  kill ${pids} 2>/dev/null || true
  sleep 1

  pids=$(lsof -ti tcp:"${port}" 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "Force killing stubborn process(es) on port ${port}: ${pids}"
    kill -9 ${pids} 2>/dev/null || true
  fi
}

close_required_ports() {
  free_port "${APP_PORT}"
  free_port "${WS_PORT}"
  free_port "${DRAWBOARD_PORT}"
}

write_pid_file() {
  cat > "${PID_FILE}" <<EOF
WS_PID=${WS_PID:-}
DRAWBOARD_PID=${DRAWBOARD_PID:-}
APP_PID=${APP_PID:-}
APP_PORT=${APP_PORT}
WS_PORT=${WS_PORT}
DRAWBOARD_PORT=${DRAWBOARD_PORT}
EOF
}

# Function to clean up background processes on exit
cleanup() {
  local exit_code=$?
  trap - SIGINT SIGTERM EXIT
  echo ""
  echo "Shutting down services..."
  # Kill the background processes
  kill "${WS_PID:-}" "${DRAWBOARD_PID:-}" "${APP_PID:-}" 2>/dev/null || true
  # Stop the database container
  docker compose stop db db-init || true
  rm -f "${PID_FILE}"
  exit "${exit_code}"
}

# Trap termination signals to ensure cleanup runs
trap cleanup SIGINT SIGTERM EXIT

echo "Closing any existing dev processes on ports ${APP_PORT}, ${WS_PORT}, ${DRAWBOARD_PORT}..."
close_required_ports

echo "Starting database via docker-compose..."
docker compose up -d db

echo "Ensuring local development database exists and is initialized..."
pnpm db:create-database
pnpm db:init -- -y

echo "Using DATABASE_URL=${DATABASE_URL}"

echo "Starting ws-server in background..."
cd "${SCRIPT_DIR}/ws-server"
if [ ! -d "node_modules" ]; then
  echo "Installing ws-server dependencies..."
  npm install
fi
echo "WS latency simulation: base=${WS_ARTIFICIAL_DELAY_MS}ms jitter=${WS_ARTIFICIAL_JITTER_MS}ms"
npm run dev &
WS_PID=$!

echo "Starting drawboard in background..."
cd "${SCRIPT_DIR}/drawBoard"
if [ ! -d "node_modules" ]; then
  echo "Installing drawboard dependencies..."
  npm install
fi
npm run dev &
DRAWBOARD_PID=$!

echo "Starting main app in background..."
cd "${SCRIPT_DIR}"
if [ ! -d "node_modules" ]; then
  echo "Installing main app dependencies..."
  pnpm install
fi
if [ ! -d "${HOME}/.cache/ms-playwright" ]; then
  echo "Installing Playwright Chromium for backend drawboard rendering..."
  npx playwright install chromium
fi
npm run dev &
APP_PID=$!
write_pid_file

echo "==========================================================="
echo "All local dev services started!"
echo "Main App:   http://localhost:${APP_PORT}"
echo "Drawboard:  http://localhost:${DRAWBOARD_PORT}"
echo "WS Server:  http://localhost:${WS_PORT}"
echo "Press Ctrl+C to stop all services."
echo "==========================================================="

# Wait indefinitely so the script doesn't exit immediately 
# and the trap can catch Ctrl+C
wait
