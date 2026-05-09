#!/bin/bash
set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT=5000

cd "${COZE_WORKSPACE_PATH}"

# 彻底清理所有可能占用端口的进程
echo "Cleaning up all processes on port ${PORT}..."

# 杀掉 Python http.server
pkill -f "python -m http.server ${PORT}" 2>/dev/null || true
# 杀掉所有占用 5000 端口的进程
for pid in $(ss -lptn 'sport = :5000' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); do
    echo "Killing process $pid on port 5000"
    kill -9 $pid 2>/dev/null || true
done

sleep 2

# 确认端口已释放
if ss -lptn 'sport = :5000' 2>/dev/null | grep -q LISTEN; then
    echo "Warning: Port 5000 still in use, forcing cleanup..."
    for pid in $(ss -lptn 'sport = :5000' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); do
        kill -9 $pid 2>/dev/null || true
    done
    sleep 2
fi

echo "Port 5000 is ready."
echo "Starting Next.js development server on port ${PORT}..."

# 启动 Next.js 服务
PORT=$PORT pnpm tsx src/server.ts
