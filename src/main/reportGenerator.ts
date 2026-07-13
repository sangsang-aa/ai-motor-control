import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Session } from '../shared/types'

const OUT_DIR = join(app.getPath('userData'), 'reports')

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}

export function generateReport(session: Session): string {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const duration = ((session.updatedAt - session.createdAt) / 1000).toFixed(1) + 's'
  const msgCount = session.messages.length
  const userMsgs = session.messages.filter(m => m.role === 'user').length
  const aiMsgs = session.messages.filter(m => m.role === 'assistant').length

  // Chat HTML
  const chatHtml = session.messages.map(m => {
    const roleLabel = m.role === 'user' ? '用户' : m.role === 'assistant' ? 'AI' : '系统'
    return `<div class="msg ${m.role}">
      <div class="label">${roleLabel}</div>
      <div class="bubble">${escapeHtml(m.content)}</div>
    </div>`
  }).join('\n')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>AI电驱控制 — 会话报告</title>
<style>
body{font-family:'Noto Sans SC',system-ui,sans-serif;max-width:800px;margin:20px auto;padding:0 20px;background:#f8f9fa;}
h1,h2{color:#333;border-bottom:2px solid #dee2e6;padding-bottom:6px;}
table{border-collapse:collapse;width:100%;margin:12px 0;}
th,td{border:1px solid #dee2e6;padding:8px 12px;}
th{background:#e9ecef;}
.stats{display:flex;gap:16px;flex-wrap:wrap;}
.stat-card{background:white;border:1px solid #dee2e6;border-radius:8px;padding:16px;flex:1;min-width:120px;text-align:center;}
.stat-card .value{font-size:24px;font-weight:bold;color:#007bff;}
.stat-card .label{font-size:13px;color:#888;}
.msg{margin:8px 0;}
.msg .label{font-size:12px;color:#888;}
.msg .bubble{display:inline-block;padding:8px 14px;border-radius:8px;max-width:80%;line-height:1.5;}
.msg.user .bubble{background:#d1e7ff;}
.msg.assistant .bubble{background:#fff;border:1px solid #dee2e6;}
</style>
</head>
<body>
<h1>📊 会话报告</h1>
<p>会话: ${escapeHtml(session.title)} | 时间: ${new Date(session.createdAt).toLocaleString('zh-CN')}</p>

<h2>统计</h2>
<div class="stats">
<div class="stat-card"><div class="value">${duration}</div><div class="label">会话时长</div></div>
<div class="stat-card"><div class="value">${msgCount}</div><div class="label">总消息数</div></div>
<div class="stat-card"><div class="value">${userMsgs}</div><div class="label">用户消息</div></div>
<div class="stat-card"><div class="value">${aiMsgs}</div><div class="label">AI回复</div></div>
</div>

<h2>聊天记录</h2>
${chatHtml || '<p>无聊天记录</p>'}
</body>
</html>`

  const filePath = join(OUT_DIR, `report_${timestamp}.html`)
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}
