#!/usr/bin/env bash
# ============================================================
#  One-click launcher for the mcb_host GUI (Linux)
#  Default /dev/ttyUSB0 @ 5625000. Override by passing args, e.g.:
#     ./run.sh --port /dev/ttyACM0 --baud 115200
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "[ERROR] $PY not found. Install Python 3 (e.g. 'sudo apt install python3')."
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- --port /dev/ttyUSB0 --baud 5625000
fi

echo "Launching: $PY -m mcb_host $*"
if ! "$PY" -m mcb_host "$@"; then
  echo
  echo "[HINT] Abnormal exit. Common causes:"
  echo "  - wrong/busy port (check: ls -l /dev/ttyUSB* /dev/ttyACM*)"
  echo "  - no permission: add yourself to the 'dialout' group, then re-login:"
  echo "        sudo usermod -aG dialout \"\$USER\""
  echo "  - baud 5625000 rejected by the driver: retry with --baud 115200"
  echo "    (and re-flash the target SCI UserBaudRate to match)."
  exit 1
fi
