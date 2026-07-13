#!/usr/bin/env bash
# 便捷运行 mock_target.py 离线测试（无需硬件）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/linux"
exec python3 tools/mock_target.py "$@"
