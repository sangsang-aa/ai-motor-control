"""会话数据跟踪模块。"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SessionData:
    """会话期间收集的统计数据。"""

    start_time: float = field(default_factory=time.time)
    end_time: float = 0.0
    telemetry: list[tuple[float, float, float]] = field(default_factory=list)
    commands: list[tuple[float, str, dict[str, Any], str]] = field(default_factory=list)
    messages: list[tuple[str, str]] = field(default_factory=list)

    @property
    def duration(self) -> float:
        end = self.end_time or time.time()
        return end - self.start_time

    @property
    def max_speed(self) -> float:
        return max((s for _, s, _ in self.telemetry), default=0.0)

    @property
    def avg_speed(self) -> float:
        if not self.telemetry:
            return 0.0
        return sum(s for _, s, _ in self.telemetry) / len(self.telemetry)

    @property
    def max_current(self) -> float:
        return max((c for _, _, c in self.telemetry), default=0.0)
