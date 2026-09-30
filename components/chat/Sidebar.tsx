// 侧栏 — Codex 风格窄版:品牌行 + 开启新对话 + 会话/工具分组 + 用户行。
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

const ICON_PROPS = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const
}

const Ico = {
  search: <svg {...ICON_PROPS}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  panel: <svg {...ICON_PROPS}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>,
  scope: <svg {...ICON_PROPS}><path d="M3 12h3l2-6 3 12 2.5-8 1.5 2h6" /></svg>,
  book: <svg {...ICON_PROPS}><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" /><path d="M8 3v18" /></svg>,
  download: <svg {...ICON_PROPS}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>,
  gear: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></svg>,
  pencil: <svg {...ICON_PROPS}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 5l4 4" /></svg>,
  close: <svg {...ICON_PROPS}><path d="M6 6l12 12M18 6 6 18" /></svg>
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
      <div style={{ width: 44, flexShrink: 0, background: 'var(--cx-bg-elev)', borderRight: '1px solid var(--cx-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 14 }}>
        <button onClick={() => setCollapsed(false)} style={{ color: 'var(--cx-muted)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }} title={t(lang, 'expandSidebar')}>{Ico.panel}</button>
        <button onClick={onOpenSearch} style={{ color: 'var(--cx-muted)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }} title={t(lang, 'search')}>{Ico.search}</button>
        <Link href="/scope" style={{ color: 'var(--cx-muted)', cursor: 'pointer', textDecoration: 'none', display: 'flex' }} title={t(lang, 'scope')}>{Ico.scope}</Link>
        <Link href="/knowledge" style={{ color: 'var(--cx-muted)', cursor: 'pointer', textDecoration: 'none', display: 'flex' }} title={t(lang, 'knowledge')}>{Ico.book}</Link>
        <button onClick={handleExport} style={{ color: 'var(--cx-muted)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }} title={t(lang, 'export')}>{Ico.download}</button>
        <button onClick={onOpenSettings} style={{ color: 'var(--cx-muted)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }} title={t(lang, 'settings')}>{Ico.gear}</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: 240, flexShrink: 0, display: 'flex' }}>
      <aside className="sidebar" style={{ width: 240, flex: 1 }}>
        <div className="sb-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', borderRadius: 6, padding: '5px 10px', flexShrink: 0 }}>
            <img src="/trademark_image.png" alt="FluxPilot" style={{ height: 22, width: 'auto', maxWidth: 26, objectFit: 'contain', flexShrink: 0 }} />
            <img src="/trademark.png" alt="FluxPilot" style={{ height: 18, width: 'auto', maxWidth: 92, objectFit: 'contain', flexShrink: 0 }} />
          </div>
          <span style={{ flex: 1 }} />
          <button onClick={onOpenSearch} style={{ color: 'var(--cx-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px', display: 'flex' }} title={t(lang, 'search')}>{Ico.search}</button>
          <button onClick={() => setCollapsed(true)} style={{ color: 'var(--cx-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px', display: 'flex' }} title={t(lang, 'hideSidebar')}>{Ico.panel}</button>
        </div>

        <div style={{ padding: '8px 12px 2px' }}>
          <button onClick={() => { const id = createSession(); selectSession(id) }} className="sidebar-new-btn">
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
            return (
              <div key={id} className="relative group">
                <button onClick={() => selectSession(id)} className={`sb-item ${active ? 'on' : ''} w-full`}>
                  <span className="truncate" style={{ flex: 1 }}>{s.title}</span>
                  <span className="group-hover:hidden" style={{ fontSize: 10, color: 'var(--cx-subtle)', flexShrink: 0 }}>{new Date(s.updatedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(id); setEditTitle(s.title) }} className="text-[10px] text-fg-subtle hover:text-fg-base px-1" title="重命名">{Ico.pencil}</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(t(lang, 'deleteSession'))) deleteSession(id) }} className="text-[10px] text-fg-subtle hover:text-danger px-1" title="删除">{Ico.close}</button>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="sb-group-title">{t(lang, 'tools')}</div>
        <div style={{ paddingBottom: 6 }}>
          <Link href="/scope" className="sb-item" style={{ textDecoration: 'none' }}>
            <span className="sb-icon">{Ico.scope}</span>{t(lang, 'scope')}
          </Link>
          <Link href="/knowledge" className="sb-item" style={{ textDecoration: 'none' }}>
            <span className="sb-icon">{Ico.book}</span>{t(lang, 'knowledge')}
          </Link>
          <button onClick={handleExport} className="sb-item">
            <span className="sb-icon">{Ico.download}</span>{t(lang, 'export')}
          </button>
          <button onClick={onOpenSettings} className="sb-item">
            <span className="sb-icon">{Ico.gear}</span>{t(lang, 'settings')}
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
