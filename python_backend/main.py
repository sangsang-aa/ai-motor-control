"""Python 后端子进程入口 — JSON Lines over stdin/stdout。

协议:
  stdin  ← {"type":"command","action":"set_speed","payload":{"rpm":2500}}
  stdout → {"type":"command_result","result":"转速已设置为 2500 RPM"}
  stdout → {"type":"telemetry","rpm":2480,"current":0.85,"seriesRpm":[...],"seriesIa":[...]}
  stdout → {"type":"serial_status","connected":true,"port":"/dev/ttyUSB0"}
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from pathlib import Path

# 确保 python_backend 在 sys.path 中（无论从哪个目录启动）
_HERE = Path(__file__).parent.resolve()
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from mcb_host.config import SerialCfg
from mcb_host.serial_link import SerialLink
from tools import execute_tool
from session_data import SessionData


class Backend:
    """JSON Lines stdin/stdout 后端服务。"""

    def __init__(self, port: str, baud: int, rpm_limit: int) -> None:
        self.port = port
        self.baud = baud
        self.rpm_limit = rpm_limit
        self.link: SerialLink | None = None
        self._running = False
        self._connected = False
        self._last_speed: float = 0.0
        self._session = SessionData()

    def start(self) -> None:
        self._running = True
        self._emit({"type": "started", "version": "1.0"})
        self._try_connect()

        poller = threading.Thread(target=self._poll_loop, daemon=True)
        poller.start()

        # Reconnect retry loop (background)
        reconnecter = threading.Thread(target=self._reconnect_loop, daemon=True)
        reconnecter.start()

        self._stdin_loop()

    def _try_connect(self) -> None:
        try:
            cfg = SerialCfg(port=self.port, baud=self.baud)
            link = SerialLink(cfg)
            link.open()
            self.link = link
            self._connected = True
            self._emit({"type": "serial_status", "connected": True, "port": self.port})
        except Exception as exc:
            self._emit({"type": "error", "message": f"串口打开失败: {exc}"})
            self._emit({"type": "serial_status", "connected": False, "port": self.port})

    def _reconnect_loop(self) -> None:
        """串口断连时每 3 秒重试连接。"""
        while self._running:
            if self.link is None or not self.link.is_open:
                if not self._connected:
                    time.sleep(3)
                    if self._running:
                        self._try_connect()
                else:
                    self._connected = False
                    self._emit({"type": "serial_status", "connected": False, "port": self.port})
            time.sleep(1)

    def _stdin_loop(self) -> None:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                cmd = json.loads(line)
            except json.JSONDecodeError:
                continue
          if cmd.get("type") != "command":
            if cmd.get("type") == "interrupt":
              self._emit({"type": "interrupted"})
            continue

            action = cmd.get("action", "")
            payload = cmd.get("payload", {})

            if action == "generate_report":
                self._handle_generate_report()
                continue

            result = execute_tool(
                action, payload,
                link=self.link,
                rpm_limit=self.rpm_limit,
                last_speed=self._last_speed,
            )

            # 跟踪命令
            self._session.commands.append((time.time(), action, payload, result))

            self._emit({"type": "command_result", "result": result})

    def _poll_loop(self) -> None:
        while self._running:
            link = self.link
            if link is not None and link.is_open:
                try:
                    frame = link.frames.get(timeout=0.1)
                except Exception:
                    continue

                speed_arr = frame[:, 1] if frame.shape[1] > 1 else frame[:, 0]
                current_arr = frame[:, 0]
                last_speed = float(speed_arr[-1]) if len(speed_arr) else 0.0
                last_current = float(current_arr[-1]) if len(current_arr) else 0.0

                self._last_speed = last_speed
                self._connected = True

                self._session.telemetry.append((time.time(), last_speed, last_current))

                self._emit({
                    "type": "telemetry",
                    "rpm": last_speed,
                    "current": last_current,
                    "seriesRpm": speed_arr.tolist() if hasattr(speed_arr, "tolist") else list(speed_arr),
                    "seriesIa": current_arr.tolist() if hasattr(current_arr, "tolist") else list(current_arr),
                })
            else:
                time.sleep(0.1)

    def _handle_generate_report(self) -> None:
        try:
            self._session.end_time = time.time()
            from report import generate_report
            out = generate_report(self._session)
            self._emit({"type": "report_path", "path": str(out)})
        except Exception as exc:
            self._emit({"type": "report_path", "path": f"error: {exc}"})

    def _emit(self, data: dict) -> None:
        sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    def stop(self) -> None:
        self._running = False
        if self.link:
            try:
                self.link.close()
            except Exception:
                pass
            self.link = None


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 电驱控制系统 Python 后端")
    parser.add_argument("--port", default="/dev/ttyUSB0")
    parser.add_argument("--baud", type=int, default=150000)
    parser.add_argument("--rpm-limit", type=int, default=6000)
    args = parser.parse_args()

    backend = Backend(args.port, args.baud, args.rpm_limit)
    try:
        backend.start()
    except KeyboardInterrupt:
        backend.stop()


if __name__ == "__main__":
    main()
