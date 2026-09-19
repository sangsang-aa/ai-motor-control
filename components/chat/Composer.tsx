// 输入框 — Altior 风格大圆角容器:占位 + 多行输入 + 底部工具行 + 圆形发送钮。
// 保留可测: textarea + 发送按钮(button[hasText='发送'])。

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { EStopButton } from './EStopButton'
import { ConversationSettingsPanel } from './ConversationSettingsPanel'
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
              <div data-testid="composer-plus-menu" style={{ position: 'absolute', bottom: 38, left: 0, zIndex: 20, background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 8, padding: 4, minWidth: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                <button onClick={() => { setMenuOpen(false); setConvOpen(true) }} data-testid="menu-conv-settings" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 6, background: 'none', border: 'none', color: '#ececec', fontSize: 13, cursor: 'pointer' }}>对话设置</button>
              </div>
            )}
          </span>
          <span className="composer-tool-pill">工具 <span style={{ fontSize: 9 }}>▾</span></span>
          <span className="composer-tool-pill think">✎ 深度思考</span>
          <EStopButton onEStop={onEStop} />
          <button
            onClick={() => sendCommand('clear_emergency_stop', {}).catch((e) => alert(`复位失败: ${e}`))}
            title="清除急停"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(43,184,168,0.12)', color: '#2bb8a8', border: '1px solid rgba(43,184,168,0.3)', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 13 }}>↺</span>复位
          </button>
          <button onClick={send} disabled={disabled || locked || !text.trim()} className="composer-send" title="发送">
            ↑
          </button>
        </div>
      </div>
      {convOpen && <ConversationSettingsPanel onClose={() => setConvOpen(false)} />}
    </div>
  )
}
