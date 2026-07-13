#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== AI 电驱控制系统 — 打包 ==="
echo ""

# 1. Build
echo "[1/5] 构建..."
node build.mjs
echo ""

# 2. Create dist directory
DIST="ai_motor_control_portable"
rm -rf "$DIST"
mkdir -p "$DIST"

echo "[2/5] 收集文件..."

# Core app
cp -r out "$DIST/"

# Python backend (skip __pycache__)
rsync -a --exclude='__pycache__' --exclude='*.pyc' python_backend/ "$DIST/python_backend/"

# Config templates
mkdir -p "$DIST/config"
cp config/llm_config.yaml "$DIST/config/"
cp config/motor_config.yaml "$DIST/config/"

# Electron runtime (binary + libs — essential)
mkdir -p "$DIST/node_modules/electron/dist"
cp node_modules/electron/dist/electron "$DIST/node_modules/electron/dist/"
cp node_modules/electron/dist/*.so "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/*.pak "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/*.dat "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/*.bin "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/icudtl.dat "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/v8_context_snapshot.bin "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/snapshot_blob.bin "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/chrome_*.pak "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/resources.pak "$DIST/node_modules/electron/dist/" 2>/dev/null || true
cp node_modules/electron/dist/resources/default_app.asar "$DIST/node_modules/electron/dist/resources/" 2>/dev/null || true

# package.json (electron needs it for app metadata)
cp package.json "$DIST/"

# Source code (so users can modify and rebuild)
cp -r src "$DIST/"
cp build.mjs "$DIST/"
cp package-lock.json "$DIST/" 2>/dev/null || true
cp tsconfig.json tsconfig.node.json tsconfig.web.json "$DIST/"
cp tailwind.config.js postcss.config.js "$DIST/"
cp electron.vite.config.ts "$DIST/" 2>/dev/null || true
cp AGENTS.md "$DIST/" 2>/dev/null || true
cp run.sh "$DIST/run_dev.sh" 2>/dev/null || true

# 3. Create portable run.sh
echo "[3/5] 生成启动脚本..."
cat > "$DIST/run.sh" << 'RUNEOF'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "========================================"
echo "  AI 电驱控制系统 v1.0"
echo "  LLM 自然语言电机控制终端"
echo "========================================"
echo ""

# Check system dependencies
MISSING=""
if ! dpkg -s libnss3 &>/dev/null 2>&1; then MISSING="$MISSING libnss3"; fi
if ! dpkg -s libnspr4 &>/dev/null 2>&1; then MISSING="$MISSING libnspr4"; fi
if ! { dpkg -s libasound2t64 || dpkg -s libasound2; } &>/dev/null 2>&1; then
  MISSING="$MISSING libasound2t64"
fi
if [ -n "$MISSING" ]; then
  echo "[!] 缺少系统依赖，请运行:"
  echo "    sudo apt install -y$MISSING"
  echo ""
fi

# Check Python
if ! python3 -c "import numpy,serial" 2>/dev/null; then
  echo "[!] 缺少 Python 依赖，请运行:"
  echo "    pip install numpy pyserial"
  echo ""
fi

# Check config
if grep -q "your-api-key-here" config/llm_config.yaml 2>/dev/null; then
  echo "[!] 请先配置 API Key:"
  echo "    编辑 config/llm_config.yaml → 替换 your-api-key-here"
  echo ""
fi

# Check serial permission
if ! groups | grep -q dialout 2>/dev/null; then
  echo "[!] 当前用户不在 dialout 组，串口可能无法访问:"
  echo "    sudo usermod -aG dialout \$USER"
  echo "    (需要重新登录生效)"
  echo ""
fi

# Launch
echo "启动中..."
ELECTRON="$(find node_modules/electron/dist -name electron -type f 2>/dev/null | head -1)"
if [ -z "$ELECTRON" ]; then
  echo "[!] 未找到 Electron 二进制文件"
  exit 1
fi

exec "$ELECTRON" .
RUNEOF

chmod +x "$DIST/run.sh"

# Copy the same run.sh for Windows info
cat > "$DIST/README.txt" << 'TXEOF'
AI 电驱控制系统 — 便携版
==========================

【直接运行（推荐）】
  ./run.sh
  无需安装任何 npm 包，使用预构建的输出。

【修改源码后重新构建】
  npm install        # 首次需要安装构建依赖（esbuild, tailwindcss 等）
  node build.mjs     # 重新构建
  ./run.sh           # 启动

【首次使用前】
  1. 编辑 config/llm_config.yaml，填入阿里云百炼 API Key
  2. 安装系统依赖: sudo apt install -y libnss3 libnspr4 libasound2t64
  3. Python: pip install numpy pyserial
  4. 串口权限: sudo usermod -aG dialout $USER（需重新登录）

【错误排查】
  "Cannot find module 'esbuild'" → 先运行 npm install
  "libnss3.so: cannot open"      → sudo apt install -y libnss3 libnspr4 libasound2t64
  "Permission denied /dev/ttyUSB0" → sudo usermod -aG dialout $USER
TXEOF

# 4. Show stats
echo "[4/5] 打包大小:"
du -sh "$DIST"

# 5. Create archive
echo "[5/5] 创建压缩包..."
ARCHIVE="ai_motor_control_portable_$(date +%Y%m%d).tar.gz"
tar -czf "$ARCHIVE" "$DIST"
echo ""
echo "=== 完成 ==="
echo "  压缩包: $(pwd)/$ARCHIVE"
echo "  大小:   $(du -sh $ARCHIVE | cut -f1)"
echo ""
echo "  发给别人后，解压运行 ./run.sh 即可"
