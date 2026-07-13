import React, { useState, useRef, useEffect } from 'react'

interface Props { onSend: (text: string) => void; disabled?: boolean }

export const Composer: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const send = () => { const t = text.trim(); if (!t || disabled) return; onSend(t); setText('') }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  useEffect(() => {
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px' }
  }, [text])

  return (
    <div className="composer-bar">
      <div className="flex gap-2 items-end">
        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" rows={1}
          className="input-base flex-1 resize-none min-h-[38px] max-h-[120px]" disabled={disabled} />
        <button onClick={send} disabled={disabled || !text.trim()} className="btn-primary h-[38px] px-5 text-sm shrink-0">
          {disabled ? '...' : '发送'}
        </button>
      </div>
    </div>
  )
}
