import React, { useState, useCallback, useRef } from 'react'
import { useSessionStore } from '../store/sessionStore'

export const Sidebar: React.FC = () => {
  const { sessions, order, currentId, createSession, deleteSession, renameSession, selectSession } = useSessionStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(224)
  const dragging = useRef(false)

  const submit = () => { if (editingId && editTitle.trim()) { renameSession(editingId, editTitle.trim()); setEditingId(null) } }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); dragging.current = true
    const sx = e.clientX; const sw = width
    const onMove = (ev: MouseEvent) => { if (dragging.current) setWidth(Math.max(160, Math.min(400, sw + ev.clientX - sx))) }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [width])

  if (collapsed) {
    return (
      <div style={{ width:36,flexShrink:0,background:'linear-gradient(180deg,#121e33 0%,#0f1a2d 100%)',borderRight:'1px solid #1e3454',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:12,gap:12 }}>
        <button onClick={() => setCollapsed(false)} style={{ color:'#8899aa',fontSize:14,cursor:'pointer',background:'none',border:'none' }} title="展开侧栏">☰</button>
        <button onClick={() => window.api.openMotorWindow().catch(console.error)} style={{ color:'#556677',fontSize:12,cursor:'pointer',background:'none',border:'none' }} title="示波器">📟</button>
        <button onClick={() => window.api.generateReport().then(p => { if(p) window.open('file://'+p) }).catch(console.error)} style={{ color:'#556677',fontSize:12,cursor:'pointer',background:'none',border:'none' }} title="导出">📄</button>
      </div>
    )
  }

  return (
    <div style={{ position:'relative',width,flexShrink:0,display:'flex' }}>
      <aside className="sidebar" style={{ width,flex:1 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px 4px' }}>
          <button onClick={() => { const id = createSession(); selectSession(id) }} className="sidebar-new-btn" style={{flex:1}}>+ 新建会话</button>
          <button onClick={() => setCollapsed(true)} style={{ color:'#556677',fontSize:16,cursor:'pointer',background:'none',border:'none',marginLeft:4,padding:'0 4px' }} title="折叠侧栏">◀</button>
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
          <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle px-1 pb-1" style={{letterSpacing:'0.08em'}}>工具栏</div>
          <button onClick={() => window.api.openMotorWindow().catch(console.error)} className="sidebar-nav-item">示波器</button>
          <button onClick={() => window.api.generateReport().then(p => { if(p) window.open('file://'+p) }).catch(console.error)} className="sidebar-nav-item">导出报告</button>
        </div>
      </aside>
      <div onMouseDown={onMouseDown} style={{ width:4,cursor:'col-resize',flexShrink:0,transition:'background 0.15s' }}
        onMouseEnter={e => (e.target as HTMLElement).style.background = '#00a8ff'}
        onMouseLeave={e => (e.target as HTMLElement).style.background = '#1e3454'}
        ref={el => { if (el) el.style.background = '#1e3454' }} />
    </div>
  )
}
