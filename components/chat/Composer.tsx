// 输入框 — Altior 风格大圆角容器:占位 + 多行输入 + 底部工具行 + 圆形发送钮。
// 保留可测: textarea + 发送按钮(button[hasText='发送'])。

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { EStopButton } from './EStopButton'
import { ConversationSettingsPanel } from './ConversationSettingsPanel'
import { KnowledgePicker } from '@/components/knowledge/KnowledgePicker'
import { useSessionStore } from '@/lib/stores/sessionStore'
import { sendCommand } from '@/lib/serial/motorController'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  locked?: boolean
  onEStop?: () => void
}

export const Composer: React.FC<Props> = ({ onSend, disabled, locked, onEStop }) => {
  const lang = useLangStore((s) => s.lang)
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [convOpen, setConvOpen] = useState(false)
  const [toolOpen, setToolOpen] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const kbCount = useSessionStore((s) => {
    const id = s.currentId
    return (id ? s.sessions[id]?.kbIds?.length : 0) ?? 0
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const send = () => {
    const tx = text.trim()
    if (!tx || disabled || locked) return
    onSend(tx); setText('')
  }
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [text])

  return (
    <div style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'center' }}>
      <div className="composer-box" style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={t(lang, 'inputPlaceholder')}
          rows={1}
          className="composer-textarea"
          disabled={disabled || locked}
        />
        <div className="composer-tools">
          <span style={{ position: 'relative' }}>
            <button className="composer-tool-pill" style={{ width: 30, height: 30, padding: 0, justifyContent: 'center', borderRadius: 8 }} title="附加" onClick={() => setMenuOpen((v) => !v)}>＋</button>
            {menuOpen && (
              <div data-testid="composer-plus-menu" className="cx-menu" style={{ position: 'absolute', bottom: 38, left: 0, zIndex: 20, minWidth: 140 }}>
                <button onClick={() => { setMenuOpen(false); setConvOpen(true) }} data-testid="menu-conv-settings" className="cx-menu-item">对话设置</button>
              </div>
            )}
          </span>
          <span style={{ position: 'relative' }}>
            <button className="composer-tool-pill" onClick={() => setToolOpen((v) => !v)}>工具{kbCount > 0 ? `（知识库 ${kbCount}）` : ''} <span style={{ fontSize: 9 }}>▾</span></button>
            {toolOpen && (
              <div data-testid="composer-tool-menu" className="cx-menu" style={{ position: 'absolute', bottom: 38, left: 0, zIndex: 20, minWidth: 150 }}>
                <button onClick={() => { setToolOpen(false); setKbOpen(true) }} data-testid="tool-knowledge" className="cx-menu-item">{t(lang, 'knowledge')}</button>
              </div>
            )}
          </span>
          <span className="composer-tool-pill think">✎ 深度思考</span>
          <EStopButton onEStop={onEStop} />
          <button
            onClick={() => sendCommand('clear_emergency_stop', {}).catch((e) => alert(`复位失败: ${e}`))}
            title="清除急停"
            className="cx-btn cx-btn-ghost"
          >
            <span style={{ fontSize: 13 }}>↺</span>复位
          </button>
          <button onClick={send} disabled={disabled || locked || !text.trim()} className="composer-send" title="发送">
            ↑
          </button>
        </div>
      </div>
      {convOpen && <ConversationSettingsPanel onClose={() => setConvOpen(false)} />}
      {kbOpen && <KnowledgePicker onClose={() => setKbOpen(false)} />}
    </div>
  )
}
