#!/usr/bin/env bash
# ============================================================
#  One-click offline test (no hardware needed) -- Linux
#    1) codec unit tests (pytest)
#    2) mock-target selftest
# ============================================================
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "[ERROR] $PY not found. Install Python 3 (e.g. 'sudo apt install python3')."
  exit 1
fi

RC=0

echo "=== [1/2] unit tests (pytest) ==="
"$PY" -m pytest tests/ -q || RC=1

echo
echo "=== [2/2] mock-target selftest ==="
"$PY" tools/mock_target.py --selftest || RC=1

echo
if [ "$RC" -eq 0 ]; then
  echo "RESULT: ALL PASSED"
else
  echo "RESULT: FAILURES ABOVE"
fi
exit "$RC"
