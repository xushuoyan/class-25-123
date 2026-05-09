#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${COZE_WORKSPACE_PATH}"

# 清理所有可能占用端口的进程
echo "Cleaning up port ${DEPLOY_RUN_PORT}..."
pkill -f "python -m http.server ${DEPLOY_RUN_PORT}" 2>/dev/null || true
for pid in $(ss -lptn 'sport = :5000' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); do
    echo "Killing process $pid on port ${DEPLOY_RUN_PORT}"
    kill -9 $pid 2>/dev/null || true
done
sleep 2

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
PORT=${DEPLOY_RUN_PORT} node dist/server.js
