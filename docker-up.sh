#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

# docker-compose setup
COMPOSE_OPTIONS=("--build")
COMPOSE_YML="docker-compose.yml"

if [[ "$(hostname)" =~ tie-lukioplus.rd.tuni.fi ]]; then
  COMPOSE_YML="production.docker-compose.yml"
  COMPOSE_OPTIONS+=("-d")

  # server has a very old version of docker and docker-compose
  docker-compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
else
  docker compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
fi
