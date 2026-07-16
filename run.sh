#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== AI 电驱控制系统 ==="
echo ""

# Check system deps
echo "[1/3] 检查系统依赖..."
MISSING=""
for lib in libnss3 libnspr4 libasound2t64; do
  if ! dpkg -s "$lib" &>/dev/null; then
    MISSING="$MISSING $lib"
  fi
done
if [ -n "$MISSING" ]; then
  echo "  缺少系统库:$MISSING"
  echo "  请运行: sudo apt install -y$MISSING"
  exit 1
fi
echo "  系统依赖 OK"

# Check Python deps
echo "[2/3] 检查 Python 依赖..."
python3 -c "import numpy, serial" 2>/dev/null || {
  echo "  缺少 Python 依赖，正在安装..."
  pip install numpy pyserial
}
echo "  Python 依赖 OK"

# Build & launch
echo "[3/3] 构建 & 启动..."
echo ""

node build.mjs
exec ./node_modules/electron/dist/electron . --no-sandbox
