// 输入框 — Altior 风格大圆角容器:占位 + 多行输入 + 底部工具行 + 圆形发送钮。
// 保留可测: textarea + 发送按钮(button[hasText='发送'])。

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { EStopButton } from './EStopButton'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  locked?: boolean
  onEStop?: () => void
}

export const Composer: React.FC<Props> = ({ onSend, disabled, locked, onEStop }) => {
  const lang = useLangStore((s) => s.lang)
  const [text, setText] = useState('')
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
        {locked && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,13,13,0.75)', fontSize: 13, color: '#ffb340', borderRadius: 18 }}>请先确认或取消当前电机控制指令</div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={locked ? '请先确认或取消当前电机控制指令' : t(lang, 'inputPlaceholder')}
          rows={1}
          className="composer-textarea"
          disabled={disabled || locked}
        />
        <div className="composer-tools">
          <button className="composer-tool-pill" style={{ width: 30, height: 30, padding: 0, justifyContent: 'center', borderRadius: 8 }} title="附加">＋</button>
          <span className="composer-tool-pill">工具 <span style={{ fontSize: 9 }}>▾</span></span>
          <span className="composer-tool-pill think">✎ 深度思考</span>
          <EStopButton onEStop={onEStop} />
          <button onClick={send} disabled={disabled || locked || !text.trim()} className="composer-send" title="发送">
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
