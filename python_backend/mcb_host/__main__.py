"""Entry point: python -m mcb_host [--port COMx] [--baud N]"""
from __future__ import annotations

import argparse

from .config import SERIAL, SerialCfg


def main() -> int:
    ap = argparse.ArgumentParser(description="Python host for mcb_open_loop_control")
    ap.add_argument("--port", default=SERIAL.port, help="serial port (default %(default)s)")
    ap.add_argument("--baud", type=int, default=SERIAL.baud,
                    help="baud rate (default %(default)s)")
    args = ap.parse_args()

    from .gui import run  # import here so --help works without Qt
    return run(SerialCfg(port=args.port, baud=args.baud))


if __name__ == "__main__":
    raise SystemExit(main())
