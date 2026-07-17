import React, { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { useCommandLock } from '../store/commandLockStore'

interface Props { onSend: (text: string) => void; disabled?: boolean; locked?: boolean }

export const Composer: React.FC<Props> = ({ onSend, disabled, locked }) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const send = () => { const t = text.trim(); if (!t || disabled || locked) return; onSend(t); setText('') }
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px' } }, [text])

  const forceCancel = () => {
    useSessionStore.getState().setInflight(false)
    useCommandLock.getState().unlock()
  }

  return (
    <div className="composer-bar" style={{position:'relative'}}>
      {locked && (
        <div style={{position:'absolute',inset:0,zIndex:10,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(10,22,40,0.7)',fontSize:13,color:'#ffb340'}}>
          请先确认或取消当前电机控制指令
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={locked ? '请先确认或取消当前电机控制指令' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
          rows={1} className="input-base flex-1 resize-none min-h-[38px] max-h-[120px]" disabled={disabled || locked} />
        {disabled && !locked ? (
          <button onClick={forceCancel} className="btn-danger h-[38px] px-5 text-sm shrink-0">取消</button>
        ) : (
          <button onClick={send} disabled={disabled || locked || !text.trim()} className="btn-primary h-[38px] px-5 text-sm shrink-0">
            {locked ? '锁定中' : disabled ? '...' : '发送'}
          </button>
        )}
      </div>
    </div>
  )
}
