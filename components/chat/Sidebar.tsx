// 侧栏 — MOTOTUNE 标题入侧栏顶部,功能栏移到新建会话/记录上方;
// 侧栏隐藏按钮在标题右侧(标题宽不足时省略号),搜索按钮与隐藏按钮同区。

'use client'

import React, { useState, useCallback, useRef } from 'react'
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
  const [width, setWidth] = useState(224)
  const dragging = useRef(false)

  const submit = () => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim())
      setEditingId(null)
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const sx = e.clientX
    const sw = width
    const onMove = (ev: MouseEvent) => {
      if (dragging.current) setWidth(Math.max(160, Math.min(400, sw + ev.clientX - sx)))
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width])

  const handleExport = () => {
    const st = useSessionStore.getState()
    const s = st.currentId ? st.sessions[st.currentId] : null
    if (!s) {
      alert('当前没有会话可导出')
      return
    }
    generateReport(s)
  }

  if (collapsed) {
    return (
      <div style={{ width: 36, flexShrink: 0, background: 'linear-gradient(180deg,#121e33 0%,#0f1a2d 100%)', borderRight: '1px solid #1e3454', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 12 }}>
        <button onClick={() => setCollapsed(false)} style={{ color: '#8899aa', fontSize: 14, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'expandSidebar')}>☰</button>
        <button onClick={onOpenSearch} style={{ color: '#556677', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'search')}>🔍</button>
        <Link href="/scope" style={{ color: '#556677', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }} title={t(lang, 'scope')}>📟</Link>
        <button onClick={handleExport} style={{ color: '#556677', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'export')}>📄</button>
        <button onClick={onOpenSettings} style={{ color: '#556677', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none' }} title={t(lang, 'settings')}>⚙</button>
      </div>
    )
  }

  const titleRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 10px 4px' }}>
      <span
        title={t(lang, 'appTitle')}
        style={{
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 18, fontWeight: 900, letterSpacing: '0.12em', fontStyle: 'italic',
          background: 'linear-gradient(135deg,#00a8ff,#4dc9ff,#00a8ff)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', backgroundClip: 'text'
        }}
      >
        {t(lang, 'appTitle')}
      </span>
      <button onClick={onOpenSearch} style={{ color: '#8899aa', fontSize: 14, cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px' }} title={t(lang, 'search')}>🔍</button>
      <button onClick={() => setCollapsed(true)} style={{ color: '#8899aa', fontSize: 14, cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px' }} title={t(lang, 'hideSidebar')}>◀</button>
    </div>
  )

  const toolBar = (
    <div className="p-2 border-b border-line space-y-1" style={{ borderBottom: '1px solid #1e3454' }}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle px-2 pb-1" style={{ letterSpacing: '0.08em' }}>{t(lang, 'tools')}</div>
      <Link href="/scope" className="sidebar-nav-item" style={{ textDecoration: 'none' }}>{t(lang, 'scope')}</Link>
      <button onClick={handleExport} className="sidebar-nav-item">{t(lang, 'export')}</button>
      <button onClick={onOpenSettings} className="sidebar-nav-item">{t(lang, 'settings')}</button>
    </div>
  )

  return (
    <div style={{ position: 'relative', width, flexShrink: 0, display: 'flex' }}>
      <aside className="sidebar" style={{ width, flex: 1 }}>
        {titleRow}
        {toolBar}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 4px' }}>
          <button onClick={() => { const id = createSession(); selectSession(id) }} className="sidebar-new-btn" style={{ flex: 1 }}>{t(lang, 'newSession')}</button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {order.length > 0 && <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle px-3 pt-3 pb-1" style={{ letterSpacing: '0.08em' }}>{t(lang, 'sessions')}</div>}
          {order.map((id) => {
            const s = sessions[id]
            if (!s) return null
            const active = id === currentId
            if (editingId === id) return (
              <div key={id} className="px-3 py-2"><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditingId(null) }} onBlur={submit} className="input-base text-xs py-1 px-2 w-full" autoFocus /></div>
            )
            const preview = s.messages.find((m) => m.role === 'user')?.content.slice(0, 28) || s.title
            return (
              <div key={id} className="relative group">
                <button onClick={() => selectSession(id)} className={`sidebar-item ${active ? 'on' : ''} w-full`}>
                  <div className="truncate">{preview}</div>
                  <div className="time">{new Date(s.updatedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(id); setEditTitle(s.title) }} className="text-[10px] text-fg-subtle hover:text-fg-base px-1">✎</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(t(lang, 'deleteSession'))) deleteSession(id) }} className="text-[10px] text-fg-subtle hover:text-danger px-1">✕</button>
                </div>
              </div>
            )
          })}
        </nav>
      </aside>
      <div onMouseDown={onMouseDown} style={{ width: 4, cursor: 'col-resize', flexShrink: 0, transition: 'background 0.15s' }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#00a8ff' }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#1e3454' }}
        ref={(el) => { if (el) el.style.background = '#1e3454' }} />
    </div>
  )
}
