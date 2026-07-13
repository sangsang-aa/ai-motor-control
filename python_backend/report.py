"""会话 HTML 报告生成。"""
from __future__ import annotations

import pathlib
import time
from typing import Any

from session_data import SessionData

_CONC_DIR = pathlib.Path(__file__).parent.parent / "conc"


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("\n", "<br>")
    )


def generate_report(data: SessionData) -> pathlib.Path:
    duration_fmt = f"{data.duration:.1f}s"

    # Chat
    chat_parts = []
    for role, content in data.messages:
        alias = {"user": "用户", "assistant": "AI", "tool_card": "工具"}
        label = alias.get(role, role)
        chat_parts.append(
            f'<div class="msg {role}"><div class="label">{_escape(label)}</div>'
            f'<div class="bubble">{_escape(content)}</div></div>'
        )
    chat_html = "\n".join(chat_parts) or "<p>无聊天记录</p>"

    # Commands
    cmd_rows = []
    for ts, name, args, result in data.commands:
        tstr = time.strftime("%H:%M:%S", time.localtime(ts))
        arg_str = ", ".join(f"{k}={v}" for k, v in args.items())
        cmd_rows.append(
            f"<tr><td>{tstr}</td><td>{_escape(name)}</td>"
            f"<td>{_escape(arg_str)}</td><td>{_escape(result)}</td></tr>"
        )
    cmd_html = (
        "<table><tr><th>时间</th><th>指令</th><th>参数</th><th>结果</th></tr>"
        + "\n".join(cmd_rows)
        + "</table>"
    ) if cmd_rows else "<p>无控制指令</p>"

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>电机控制会话报告</title>
<style>
body {{ font-family: 'Noto Sans SC', system-ui, sans-serif; max-width: 800px; margin: 20px auto; padding: 0 20px; background: #f8f9fa; }}
h1, h2 {{ color: #333; border-bottom: 2px solid #dee2e6; padding-bottom: 6px; }}
table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
th, td {{ border: 1px solid #dee2e6; padding: 8px 12px; text-align: left; }}
th {{ background: #e9ecef; }}
.stats {{ display: flex; gap: 16px; flex-wrap: wrap; }}
.stat-card {{ background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; flex: 1; min-width: 120px; text-align: center; }}
.stat-card .value {{ font-size: 24px; font-weight: bold; color: #007bff; }}
.stat-card .label {{ font-size: 13px; color: #888; }}
.msg {{ margin: 8px 0; }}
.msg .label {{ font-size: 12px; color: #888; }}
.msg .bubble {{ display: inline-block; padding: 8px 14px; border-radius: 8px; max-width: 80%; line-height: 1.5; }}
.msg.user .bubble {{ background: #d1e7ff; }}
.msg.assistant .bubble {{ background: #ffffff; border: 1px solid #dee2e6; }}
.msg.tool_card .bubble {{ background: #fff3cd; border: 1px solid #ffc107; }}
</style>
</head>
<body>
<h1>📊 电机控制会话报告</h1>
<p>生成时间: {time.strftime("%Y-%m-%d %H:%M:%S")}</p>

<h2>运行统计</h2>
<div class="stats">
<div class="stat-card"><div class="value">{duration_fmt}</div><div class="label">运行时长</div></div>
<div class="stat-card"><div class="value">{data.max_speed:.0f}</div><div class="label">最高转速 (RPM)</div></div>
<div class="stat-card"><div class="value">{data.avg_speed:.0f}</div><div class="label">平均转速 (RPM)</div></div>
<div class="stat-card"><div class="value">{data.max_current:.2f}</div><div class="label">最大电流 (A)</div></div>
</div>

<h2>控制指令时间轴</h2>
{cmd_html}

<h2>完整聊天记录</h2>
{chat_html}
</body>
</html>"""

    _CONC_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    out_path = _CONC_DIR / f"session_report_{timestamp}.html"
    out_path.write_text(html, encoding="utf-8")
    return out_path
