'use client'

import React, { useState, useMemo } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { useSessionStore } from '@/lib/stores/sessionStore'

export const SearchDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lang = useLangStore((s) => s.lang)
  const { sessions, order, selectSession } = useSessionStore()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return order
      .map((id) => sessions[id])
      .filter((s) => s && (s.title.toLowerCase().includes(q) || s.messages.some((m) => m.content.toLowerCase().includes(q))))
  }, [query, order, sessions])

  const jump = (id: string) => {
    selectSession(id)
    onClose()
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80
  }
  const box: React.CSSProperties = {
    background: 'var(--cx-surface)', border: '1px solid var(--cx-border-2)', borderRadius: 14,
    width: 460, maxWidth: '90vw', maxHeight: '70vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', color: 'var(--cx-text)'
  }

  return (
    <div style={overlay} data-testid="search-overlay">
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--cx-border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t(lang, 'search')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cx-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(lang, 'searchPlaceholder')}
          className="input-base"
          style={{ margin: '10px 14px', width: 'auto', flexShrink: 0 }}
        />
        <div style={{ overflowY: 'auto', padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {query.trim() && results.length === 0 && (
            <div style={{ color: 'var(--cx-muted)', fontSize: 12, textAlign: 'center', padding: 24 }}>{t(lang, 'noResult')}</div>
          )}
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              data-testid="search-result"
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', color: 'var(--cx-text)'
              }}
            >
              <div style={{ fontSize: 13 }}>{s.title}</div>
              <div style={{ fontSize: 10, color: 'var(--cx-subtle)', marginTop: 2 }}>
                {new Date(s.updatedAt).toLocaleString('zh-CN')} · {s.messages.length} 条
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
