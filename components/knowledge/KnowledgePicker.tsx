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
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
  const box: React.CSSProperties = {
    background: 'var(--cx-surface)', border: '1px solid var(--cx-border-2)', borderRadius: 14,
    padding: '20px 24px', width: 460, maxWidth: '90vw', color: 'var(--cx-text)'
  }

  return (
    <div style={overlay} data-testid="kb-picker-overlay">
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{t(lang, 'knowledge')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cx-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--cx-muted)', marginBottom: 10 }}>{t(lang, 'kbPickerHint')}</div>

        {kbs.length === 0 && <div style={{ fontSize: 12, color: 'var(--cx-subtle)', padding: '8px 0' }}>{t(lang, 'kbNoKb')}</div>}

        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {kbs.map((kb) => (
            <label
              key={kb.id}
              data-testid="kb-pick-item"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--cx-border)', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selected.includes(kb.id)}
                onChange={() => toggle(kb.id)}
                style={{ accentColor: 'var(--cx-text)' }}
              />
              <span style={{ fontSize: 13 }}>{kb.name}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={clear} className="cx-btn cx-btn-ghost" data-testid="kb-clear">{t(lang, 'kbClear')}</button>
          <button onClick={deliver} className="cx-btn cx-btn-primary" data-testid="kb-deliver">{t(lang, 'kbDeliver')}</button>
        </div>
      </div>
    </div>
  )
}
