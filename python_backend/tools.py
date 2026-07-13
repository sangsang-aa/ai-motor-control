"""LLM 工具本地执行逻辑（Python 后端侧）。"""
from __future__ import annotations

from typing import Any


def execute_tool(
    action: str,
    payload: dict[str, Any],
    link=None,
    rpm_limit: int = 6000,
    last_speed: float = 0.0,
) -> str:
    """执行已确认的工具调用，返回结果字符串。"""

    if action == "set_speed":
        rpm = int(payload.get("rpm", 0))
        rpm = max(0, min(rpm_limit, rpm))
        if link is not None and link.is_open:
            link.send_command(rpm, 1)
            return f"转速已设置为 {rpm} RPM"
        return f"[模拟] 转速已设置为 {rpm} RPM（未连接硬件）"

    if action == "set_motor_state":
        on = bool(payload.get("on", False))
        if link is not None and link.is_open:
            if on:
                link.send_command(int(last_speed), 1)
            else:
                link.send_command(0, 0)
            state = "启动" if on else "停止"
            return f"电机已{state}"
        state = "启动" if on else "停止"
        return f"[模拟] 电机已{state}（未连接硬件）"

    if action == "get_status":
        if link is not None and link.is_open:
            from mcb_host.config import RX_CHANNELS
            try:
                frame = link.frames.get_nowait()
                speed = float(frame[-1, 1]) if frame.shape[1] > 1 else 0.0
                current = float(frame[-1, 0])
                return f"当前状态 — 转速: {speed:.0f} RPM, 相电流: {current:.2f} A"
            except Exception:
                pass
        return "当前状态 — 转速: 0 RPM, 相电流: 0.00 A"

    return f"未知指令: {action}"
