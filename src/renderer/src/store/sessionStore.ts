import { create } from 'zustand'
import type { Session, Message, LlmEvent } from '../../../shared/types'

let msgCounter = 0
function genId(): string { return `msg_${Date.now()}_${++msgCounter}` }

interface SessionState {
  sessions: Record<string, Session>
  order: string[]
  currentId: string | null
  inflight: boolean
  hydrate: (list: Session[]) => void
  createSession: () => string
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  selectSession: (id: string) => void
  pushUserMessage: (text: string) => void
  applyLlmEvent: (event: LlmEvent) => void
  setInflight: (v: boolean) => void
}

function saveToDisk(s: Session) { window.api.saveSession(s).catch(() => {}) }

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  order: [],
  currentId: null,
  inflight: false,

  hydrate: (list) => {
    const sessions: Record<string, Session> = {}
    const order: string[] = []
    for (const s of list) { sessions[s.id] = { ...s, messages: s.messages.map(m => ({ ...m, streaming: false })) }; order.push(s.id) }
    set({ sessions, order, currentId: order[0] || null })
  },

  createSession: () => {
    const id = `session_${Date.now()}`; const now = Date.now()
    const s: Session = { id, title: '新会话', createdAt: now, updatedAt: now, status: 'idle', messages: [] }
    set(st => ({ sessions: { ...st.sessions, [id]: s }, order: [id, ...st.order], currentId: id }))
    saveToDisk(s); return id
  },

  deleteSession: (id) => {
    set(st => { const { [id]: _, ...rest } = st.sessions; const order = st.order.filter(o => o !== id); const currentId = st.currentId === id ? (order[0] || null) : st.currentId; return { sessions: rest, order, currentId } })
    window.api.deleteSession(id).catch(() => {})
  },

  renameSession: (id, title) => {
    set(st => {
      const s = st.sessions[id]; if (!s) return st
      const updated = { ...s, title, updatedAt: Date.now() }
      return { sessions: { ...st.sessions, [id]: updated } }
    })
    window.api.renameSession(id, title).catch(() => {})
  },

  selectSession: (id) => set({ currentId: id }),

  pushUserMessage: (text) => {
    const { currentId, sessions } = get(); if (!currentId) return
    const s = sessions[currentId]; if (!s) return
    const msg: Message = { id: genId(), role: 'user', content: text, ts: Date.now() }
    const updated: Session = { ...s, updatedAt: Date.now(), status: 'running', messages: [...s.messages, msg] }
    set(st => ({ sessions: { ...st.sessions, [currentId]: updated }, inflight: true }))
    saveToDisk(updated)
  },

  applyLlmEvent: (event) => {
    const { currentId, sessions } = get(); if (!currentId) return
    const s = sessions[currentId]; if (!s) return
    const msgs = [...s.messages]
    if (event.type === 'text') {
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant' && last.streaming) msgs[msgs.length - 1] = { ...last, content: last.content + event.content }
      else msgs.push({ id: genId(), role: 'assistant', content: event.content, ts: Date.now(), streaming: true })
    } else if (event.type === 'turn_end') {
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') msgs[msgs.length - 1] = { ...last, streaming: false }
    } else if (event.type === 'error') {
      msgs.push({ id: genId(), role: 'assistant', content: `⚠ ${event.message}`, ts: Date.now() })
    } else if (event.type === 'interrupted') {
      msgs.push({ id: genId(), role: 'system', content: '--- 操作已终止 ---', ts: Date.now() })
    }
    const done = event.type === 'turn_end' || event.type === 'error' || event.type === 'interrupted'
    const updated: Session = { ...s, updatedAt: Date.now(), messages: msgs, status: done ? 'idle' : 'running' }
    set(st => ({ sessions: { ...st.sessions, [currentId]: updated }, inflight: done ? false : st.inflight }))
    saveToDisk(updated)
  },

  setInflight: (v) => set({ inflight: v })
}))
