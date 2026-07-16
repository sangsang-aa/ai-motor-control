import React, { useState } from 'react'
import { useSessionStore } from '../store/sessionStore'

export const Sidebar: React.FC = () => {
  const { sessions, order, currentId, createSession, deleteSession, renameSession, selectSession } = useSessionStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const submit = () => { if (editingId && editTitle.trim()) { renameSession(editingId, editTitle.trim()); setEditingId(null) } }

  return (
    <aside className="sidebar">
      <div className="p-3 border-b border-line">
        <button onClick={() => { const id = createSession(); selectSession(id) }} className="sidebar-new-btn">+ 新建会话</button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {order.length > 0 && <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle px-3 pt-3 pb-1" style={{letterSpacing:'0.08em'}}>历史会话</div>}
        {order.map(id => {
          const s = sessions[id]; if (!s) return null; const active = id === currentId
          if (editingId === id) return (
            <div key={id} className="px-3 py-2"><input value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditingId(null) }} onBlur={submit} className="input-base text-xs py-1 px-2 w-full" autoFocus /></div>
          )
          const preview = s.messages.find(m => m.role === 'user')?.content.slice(0, 28) || s.title
          return (
            <div key={id} className="relative group">
              <button onClick={() => selectSession(id)} className={`sidebar-item ${active ? 'on' : ''} w-full`}>
                <div className="truncate">{preview}</div>
                <div className="time">{new Date(s.updatedAt).toLocaleString('zh-CN', { hour:'2-digit', minute:'2-digit' })}</div>
              </button>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1">
                <button onClick={e => { e.stopPropagation(); setEditingId(id); setEditTitle(s.title) }} className="text-[10px] text-fg-subtle hover:text-fg-base px-1">✎</button>
                <button onClick={e => { e.stopPropagation(); if (confirm('删除此会话？')) deleteSession(id) }} className="text-[10px] text-fg-subtle hover:text-danger px-1">✕</button>
              </div>
            </div>
          )
        })}
      </nav>
      <div className="p-2 border-t border-line space-y-1">
        <button onClick={() => window.api.openMotorWindow().catch(console.error)} className="sidebar-nav-item">示波器</button>
        <button onClick={() => window.api.generateReport().then(p => { if(p) window.open('file://'+p) }).catch(console.error)} className="sidebar-nav-item">导出报告</button>
      </div>
    </aside>
  )
}
