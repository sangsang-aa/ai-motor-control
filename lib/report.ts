/**
 * 会话报告导出(浏览器版)— 替代 Electron 版 reportGenerator.ts(文件系统 + shell.open)。
 * 前端直接生成 HTML 并通过 Blob 下载,无需服务端。
 */
import type { Session } from './types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtml(session: Session): string {
  const rows = session.messages
    .map((m) => {
      const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? 'AI' : '系统'
      const time = new Date(m.ts).toLocaleString('zh-CN')
      return `<div class="msg ${m.role}"><span class="tag">${role}</span><span class="time">${esc(time)}</span><div class="content">${esc(m.content)}</div></div>`
    })
    .join('')

  const stats = {
    messages: session.messages.length,
    user: session.messages.filter((m) => m.role === 'user').length,
    duration: Math.max(0, session.updatedAt - session.createdAt)
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>会话报告 - ${esc(session.title)}</title>
<style>
  body { font-family: 'Noto Sans SC', system-ui, sans-serif; background: #0a1628; color: #e8ecf1; margin: 0; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #556677; font-size: 12px; margin-bottom: 24px; }
  .cards { display: flex; gap: 12px; margin-bottom: 24px; }
  .card { background: #121e33; border: 1px solid #1e3454; border-radius: 8px; padding: 12px 20px; }
  .card .v { font-size: 20px; font-weight: 700; color: #00a8ff; }
  .card .l { font-size: 11px; color: #556677; }
  .msg { margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; background: #121e33; border: 1px solid #1e3454; }
  .msg.user { border-left: 3px solid #00a8ff; }
  .msg.assistant { border-left: 3px solid #ff9500; }
  .msg.system { background: transparent; border: none; color: #8899aa; font-size: 12px; }
  .tag { font-size: 11px; font-weight: 700; color: #8899aa; margin-right: 8px; }
  .time { font-size: 11px; color: #556677; }
  .content { margin-top: 6px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
  <h1>${esc(session.title)}</h1>
  <div class="meta">创建: ${esc(new Date(session.createdAt).toLocaleString('zh-CN'))} · 更新: ${esc(new Date(session.updatedAt).toLocaleString('zh-CN'))}</div>
  <div class="cards">
    <div class="card"><div class="v">${stats.messages}</div><div class="l">消息总数</div></div>
    <div class="card"><div class="v">${stats.user}</div><div class="l">用户消息</div></div>
    <div class="card"><div class="v">${Math.round(stats.duration / 1000)}s</div><div class="l">会话时长</div></div>
  </div>
  ${rows}
</body>
</html>`
}

/** 生成报告并触发浏览器下载 */
export function generateReport(session: Session): void {
  const html = buildHtml(session)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safeTitle = session.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30)
  a.href = url
  a.download = `会话报告_${safeTitle}_${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
