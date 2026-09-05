// 侧栏 — Altior 风格窄版:品牌行 + 开启新对话 + 会话/工具分组 + 用户行。
// 保留可测选择器:aside.sidebar / .sidebar-item / aside.sidebar a[href="/scope"] / 折叠+搜索按钮 title。

'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { useSessionStore } from '@/lib/stores/sessionStore'
import { generateReport } from '@/lib/report'
import { useLangStore, t } from '@/lib/i18n'

interface Props {
  onOpenSettings: () => void
  onOpenSearch: () => void
}

export const Sidebar: React.FC<Props> = ({ onOpenSettings, onOpenSearch }) => {
  const lang = useLangStore((s) => s.lang)
  const { sessions, order, currentId, createSession, deleteSession, renameSession, selectSession } = useSessionStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const dragging = useRef(false)

  const submit = () => {
    if (editingId && editTitle.trim()) { renameSession(editingId, editTitle.trim()); setEditingId(null) }
  }

  const handleExport = () => {
    const st = useSessionStore.getState()
    const s = st.currentId ? st.sessions[st.currentId] : null
    if (!s) { alert('当前没有会话可导出'); return }
    generateReport(s)
  }

  if (collapsed) {
    return (
      <div style={{ width: 44, flexShrink: 0, background: '#101010', borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 14 }}>
        <button onClick={() => setCollapsed(false)} style={{ color: '#9aa0a6', fontSize: 15, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'expandSidebar')}>☰</button>
        <button onClick={onOpenSearch} style={{ color: '#9aa0a6', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'search')}>🔍</button>
        <Link href="/scope" style={{ color: '#9aa0a6', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }} title={t(lang, 'scope')}>📟</Link>
        <button onClick={handleExport} style={{ color: '#9aa0a6', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'export')}>📄</button>
        <button onClick={onOpenSettings} style={{ color: '#9aa0a6', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'settings')}>⚙</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: 240, flexShrink: 0, display: 'flex' }}>
      <aside className="sidebar" style={{ width: 240, flex: 1, background: '#121212' }}>
        <div className="sb-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', borderRadius: 6, padding: '5px 10px', flexShrink: 0 }}>
            <img src="/trademark_image.png" alt="FluxPilot" style={{ height: 22, width: 'auto', maxWidth: 26, objectFit: 'contain', flexShrink: 0 }} />
            <img src="/trademark.png" alt="FluxPilot" style={{ height: 18, width: 'auto', maxWidth: 92, objectFit: 'contain', flexShrink: 0 }} />
          </div>
          <span style={{ flex: 1 }} />
          <button onClick={onOpenSearch} style={{ color: '#9aa0a6', fontSize: 14, cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px' }} title={t(lang, 'search')}>🔍</button>
          <button onClick={() => setCollapsed(true)} style={{ color: '#9aa0a6', fontSize: 15, cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px' }} title={t(lang, 'hideSidebar')}>◀</button>
        </div>

        <div style={{ padding: '8px 12px 2px' }}>
          <button onClick={() => { const id = createSession(); selectSession(id) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 8, fontSize: 14, color: '#e8ecf1', background: '#1c1c1c', border: '1px solid #2a2a2a', cursor: 'pointer', textAlign: 'center' }}>
            {t(lang, 'newSession')}
          </button>
        </div>

        <div className="sb-group-title">{t(lang, 'sessions')}</div>
        <nav className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {order.map((id) => {
            const s = sessions[id]
            if (!s) return null
            const active = id === currentId
            if (editingId === id) return (
              <div key={id} style={{ padding: '6px 12px' }}>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditingId(null) }} onBlur={submit} className="input-base text-xs py-1 px-2 w-full" autoFocus />
              </div>
            )
            const preview = s.messages.find((m) => m.role === 'user')?.content.slice(0, 22) || s.title
            return (
              <div key={id} className="relative group">
                <button onClick={() => selectSession(id)} className={`sb-item ${active ? 'on' : ''} w-full`}>
                  <span className="truncate" style={{ flex: 1 }}>{preview}</span>
                  <span className="group-hover:hidden" style={{ fontSize: 10, color: '#6b7075', flexShrink: 0 }}>{new Date(s.updatedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(id); setEditTitle(s.title) }} className="text-[10px] text-fg-subtle hover:text-fg-base px-1" title="重命名">✎</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(t(lang, 'deleteSession'))) deleteSession(id) }} className="text-[10px] text-fg-subtle hover:text-danger px-1" title="删除">✕</button>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="sb-group-title">{t(lang, 'tools')}</div>
        <div style={{ paddingBottom: 6 }}>
          <Link href="/scope" className="sb-item" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 14 }}>📟</span>{t(lang, 'scope')}
          </Link>
          <button onClick={handleExport} className="sb-item">
            <span style={{ fontSize: 14 }}>📄</span>{t(lang, 'export')}
          </button>
          <button onClick={onOpenSettings} className="sb-item">
            <span style={{ fontSize: 14 }}>⚙</span>{t(lang, 'settings')}
          </button>
        </div>

        <div className="sb-user">
          <span className="avatar">s</span>
          <span className="uname">sangsang</span>
        </div>
      </aside>
      <div style={{ width: 4, cursor: 'col-resize', flexShrink: 0, background: 'transparent' }} />
    </div>
  )
}
