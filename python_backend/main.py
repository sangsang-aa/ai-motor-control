"""Python backend — multi-threaded serial + tool executor + JSON Lines."""
from __future__ import annotations
import argparse, json, sys, threading, time, queue
from pathlib import Path
_HERE = Path(__file__).parent.resolve()
if str(_HERE) not in sys.path: sys.path.insert(0, str(_HERE))
from mcb_host.config import SerialCfg
from mcb_host.serial_link import SerialLink
from tools import execute_tool
from session_data import SessionData

class Backend:
    def __init__(self, port: str, baud: int, rpm_limit: int) -> None:
        self.port = port; self.baud = baud; self.rpm_limit = rpm_limit
        self._running = False; self._connected = False
        self._last_speed = 0.0; self._session = SessionData()
        self._status_lock = threading.Lock()
        self._status = {"rpm": 0.0, "current": 0.0}
        self._serial_queue = queue.Queue()
        self._serial_result = queue.Queue()
        self._cmd_q = queue.Queue()

    def start(self) -> None:
        self._running = True
        self._emit({"type": "started", "version": "1.0"})
        threading.Thread(target=self._serial_worker, daemon=True).start()
        threading.Thread(target=self._tool_worker, daemon=True).start()
        self._stdin_loop()

    # ── Serial worker thread (exclusive pyserial) ──────────────────────────
    def _serial_worker(self) -> None:
        link: SerialLink | None = None
        while self._running:
            # Drain all pending commands (non-blocking)
            while True:
                try:
                    msg = self._serial_queue.get_nowait()
                    action = msg.get("action", "")
                    if action == "connect":
                        port = str(msg.get("port", self.port))
                        baud = int(msg.get("baud", self.baud))
                        try:
                            if link:
                                try: link.close()
                                except: pass
                            link = SerialLink(SerialCfg(port=port, baud=baud))
                            link.open()
                            self._connected = True
                            self._serial_result.put({"ok": True})
                            self._emit({"type": "serial_status", "connected": True, "port": port, "baudRate": baud})
                        except Exception as e:
                            self._serial_result.put({"ok": False, "error": str(e)})
                            self._emit({"type": "error", "message": str(e)})
                            self._emit({"type": "serial_status", "connected": False, "port": ""})
                    elif action == "disconnect":
                        if link:
                            try: link.close()
                            except: pass
                            link = None
                        self._connected = False
                        self._serial_result.put({"ok": True})
                        self._emit({"type": "serial_status", "connected": False, "port": ""})
                    elif action == "execute":
                        func = msg.get("func")
                        if func == "send_command":
                            rpm = int(msg.get("rpm", 0)); on = int(msg.get("on", 0))
                            if link and link.is_open:
                                link.send_command(rpm, on)
                                self._serial_result.put({"ok": True, "result": f"OK rpm={rpm} on={on}"})
                            else:
                                self._serial_result.put({"ok": False, "error": "not connected"})
                except queue.Empty:
                    break
                except Exception as e:
                    self._serial_result.put({"ok": False, "error": str(e)})

            # Drain ALL available frames
            if link and link.is_open:
                while True:
                    try:
                        frame = link.frames.get_nowait()
                        speed_arr = frame[:, 1] if frame.shape[1] > 1 else frame[:, 0]
                        current_arr = frame[:, 0]
                        ls = float(speed_arr[-1]) if len(speed_arr) else 0.0
                        lc = float(current_arr[-1]) if len(current_arr) else 0.0
                        self._last_speed = ls
                        with self._status_lock:
                            self._status = {"rpm": ls, "current": lc}
                        self._session.telemetry.append((time.time(), ls, lc))
                        self._emit({"type": "telemetry", "rpm": ls, "current": lc,
                            "seriesRpm": speed_arr.tolist() if hasattr(speed_arr,"tolist") else list(speed_arr),
                            "seriesIa": current_arr.tolist() if hasattr(current_arr,"tolist") else list(current_arr)})
                    except queue.Empty:
                        break
                    except Exception:
                        pass

            # Idle sleep when nothing to do
            if not (link and link.is_open):
                time.sleep(0.1)

        if link:
            try: link.close()
            except: pass

    # ── Tool executor thread ──────────────────────────────────────────────
    def _tool_worker(self) -> None:
        while self._running:
            try:
                msg = self._cmd_q.get(timeout=1.0)
                action = msg.get("action", ""); payload = msg.get("payload", {})
                if action in ("set_speed", "set_motor_state"):
                    # Route to serial thread
                    if action == "set_speed":
                        rpm = max(0, min(self.rpm_limit, int(payload.get("rpm", 0))))
                        self._serial_queue.put({"action": "execute", "func": "send_command", "rpm": rpm, "on": 1})
                    elif action == "set_motor_state":
                        on = 1 if payload.get("on") else 0
                        self._serial_queue.put({"action": "execute", "func": "send_command", "rpm": int(self._last_speed), "on": on})
                    try:
                        res = self._serial_result.get(timeout=5.0)
                        result = res.get("result", res.get("error", "unknown"))
                    except queue.Empty:
                        result = "timeout: serial command did not complete in 5s"
                elif action == "get_status":
                    with self._status_lock:
                        st = dict(self._status)
                    result = f"转速: {st['rpm']:.0f} RPM, 相电流: {st['current']:.2f} A"
                else:
                    result = execute_tool(action, payload, link=None, rpm_limit=self.rpm_limit, last_speed=self._last_speed)
                self._session.commands.append((time.time(), action, payload, result))
                self._emit({"type": "command_result", "result": result})
            except queue.Empty:
                pass

    # ── stdin loop ────────────────────────────────────────────────────────
    def _stdin_loop(self) -> None:
        for line in sys.stdin:
            line = line.strip()
            if not line: continue
            try: cmd = json.loads(line)
            except: continue
            t = cmd.get("type", "")
            if t == "ping":
                self._emit({"type": "pong"})
                continue
            if t == "interrupt":
                # Clear serial queue
                while not self._serial_queue.empty():
                    try: self._serial_queue.get_nowait()
                    except: pass
                self._emit({"type": "interrupted"})
                continue
            if t == "command":
                action = cmd.get("action", "")
                payload = cmd.get("payload", {})
                if action == "connect":
                    self._serial_queue.put({"action": "connect", "port": str(payload.get("port", self.port)), "baud": int(payload.get("baud_rate", self.baud))})
                    continue
                if action == "disconnect":
                    self._serial_queue.put({"action": "disconnect"})
                    continue
                if action == "generate_report":
                    try:
                        self._session.end_time = time.time()
                        from report import generate_report
                        out = generate_report(self._session)
                        self._emit({"type": "command_result", "result": str(out)})
                    except Exception as e:
                        self._emit({"type": "command_result", "result": f"error: {e}"})
                    continue
                # Route to tool worker
                self._cmd_q.put({"action": action, "payload": payload})

    def _emit(self, data: dict) -> None:
        sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    def stop(self) -> None:
        self._running = False

def main() -> None:
    p = argparse.ArgumentParser(); p.add_argument("--port", default="/dev/ttyUSB0")
    p.add_argument("--baud", type=int, default=150000); p.add_argument("--rpm-limit", type=int, default=6000)
    args = p.parse_args()
    backend = Backend(args.port, args.baud, args.rpm_limit)
    try: backend.start()
    except KeyboardInterrupt: backend.stop()

if __name__ == "__main__": main()
