"""配置加载模块：读取 YAML 配置文件并返回配置对象。"""
from __future__ import annotations

import pathlib
from dataclasses import dataclass

import yaml


_HERE = pathlib.Path(__file__).parent


@dataclass
class LLMConfig:
    base_url: str
    api_key: str
    model_name: str
    system_prompt: str


@dataclass
class MotorConfig:
    port: str
    baud_rate: int
    rpm_limit: int
    current_alarm_threshold: float


def load_llm_config(path: str | pathlib.Path | None = None) -> LLMConfig:
    p = pathlib.Path(path) if path else _HERE / "llm_config.yaml"
    with open(p, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return LLMConfig(
        base_url=data["base_url"],
        api_key=data["api_key"],
        model_name=data["model_name"],
        system_prompt=data["system_prompt"],
    )


def load_motor_config(path: str | pathlib.Path | None = None) -> MotorConfig:
    p = pathlib.Path(path) if path else _HERE / "motor_config.yaml"
    with open(p, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return MotorConfig(
        port=data["port"],
        baud_rate=data["baud_rate"],
        rpm_limit=data["rpm_limit"],
        current_alarm_threshold=data["current_alarm_threshold"],
    )


__all__ = ["LLMConfig", "MotorConfig", "load_llm_config", "load_motor_config"]
