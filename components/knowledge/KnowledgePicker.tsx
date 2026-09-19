// 知识库选择弹窗 — 勾选知识库并"投送"到当前会话(之后每次发送自动注入)

'use client'

import React, { useEffect, useState } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { useSessionStore } from '@/lib/stores/sessionStore'
import { useKnowledgeStore } from '@/lib/stores/knowledgeStore'

export const KnowledgePicker: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lang = useLangStore((s) => s.lang)
  const kbs = useKnowledgeStore((s) => s.kbs)
  const refresh = useKnowledgeStore((s) => s.refresh)
  const sessions = useSessionStore((s) => s.sessions)
  const currentId = useSessionStore((s) => s.currentId)
  const session = currentId ? sessions[currentId] : undefined
  const [selected, setSelected] = useState<string[]>(session?.kbIds ?? [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const deliver = () => {
    const st = useSessionStore.getState()
    st.setKbIds(selected)
    if (selected.length > 0) {
      const names = kbs.filter((k) => selected.includes(k.id)).map((k) => k.name).join('、')
      st.pushSystemMessage(`已投送知识库：${names}`)
    }
    onClose()
  }

  const clear = () => {
    useSessionStore.getState().setKbIds([])
    onClose()
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,13,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
  const box: React.CSSProperties = {
    background: '#121212', border: '1px solid #2a2a2a', borderRadius: 12,
    padding: '20px 24px', width: 460, maxWidth: '90vw', color: '#ececec'
  }

  return (
    <div style={overlay} data-testid="kb-picker-overlay">
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>📚 {t(lang, 'knowledge')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9aa0a6', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 10 }}>{t(lang, 'kbPickerHint')}</div>

        {kbs.length === 0 && <div style={{ fontSize: 12, color: '#6b7075', padding: '8px 0' }}>{t(lang, 'kbNoKb')}</div>}

        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {kbs.map((kb) => (
            <label
              key={kb.id}
              data-testid="kb-pick-item"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2a2a', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selected.includes(kb.id)}
                onChange={() => toggle(kb.id)}
                style={{ accentColor: '#2bb8a8' }}
              />
              <span style={{ fontSize: 13 }}>{kb.name}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={clear} className="btn-ghost text-xs" data-testid="kb-clear">{t(lang, 'kbClear')}</button>
          <button onClick={deliver} className="btn-primary text-xs" data-testid="kb-deliver">{t(lang, 'kbDeliver')}</button>
        </div>
      </div>
    </div>
  )
}
