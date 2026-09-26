// 对话设置弹窗 — 会话级自定义提示词(存到当前 session,随会话删除)

'use client'

import React, { useState } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { useSessionStore } from '@/lib/stores/sessionStore'

export const ConversationSettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lang = useLangStore((s) => s.lang)
  const sessions = useSessionStore((s) => s.sessions)
  const currentId = useSessionStore((s) => s.currentId)
  const session = currentId ? sessions[currentId] : undefined
  const [prompt, setPrompt] = useState(session?.systemPrompt ?? '')

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
  const box: React.CSSProperties = {
    background: 'var(--cx-surface)', border: '1px solid var(--cx-border-2)', borderRadius: 14,
    padding: '20px 24px', width: 520, maxWidth: '90vw', color: 'var(--cx-text)'
  }

  const save = () => {
    useSessionStore.getState().setSystemPrompt(prompt)
    onClose()
  }

  return (
    <div style={overlay} data-testid="conv-settings-overlay">
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>对话设置</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cx-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--cx-muted)', marginBottom: 8 }}>提示词 / 当前任务(仅作用于本会话,随会话删除)</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          placeholder="输入提示词，描述当前任务…(留空则使用默认系统提示词)"
          data-testid="conv-system-prompt"
          style={{ width: '100%', background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--cx-text)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} className="cx-btn cx-btn-ghost">关闭</button>
          <button onClick={save} className="cx-btn cx-btn-primary" data-testid="conv-save">保存</button>
        </div>
      </div>
    </div>
  )
}
