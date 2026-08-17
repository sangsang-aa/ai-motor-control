// 会话状态 — 从 Electron 版迁移;持久化从文件系统改为 localStorage(浏览器版)

import { create } from 'zustand'
import type { Session, Message, LlmEvent } from '../types'

const LS_SESSIONS_KEY = 'mototune.sessions'
const LS_ORDER_KEY = 'mototune.sessions.order'

let msgCounter = 0
function genId(): string {
  return `msg_${Date.now()}_${++msgCounter}`
}

interface SessionState {
  sessions: Record<string, Session>
  order: string[]
  currentId: string | null
  inflight: boolean
  hydrate: () => void
  createSession: () => string
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  selectSession: (id: string) => void
  pushUserMessage: (text: string) => void
  applyLlmEvent: (event: LlmEvent) => void
  setInflight: (v: boolean) => void
}

function persist(state: { sessions: Record<string, Session>; order: string[] }) {
  try {
    localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(state.sessions))
    localStorage.setItem(LS_ORDER_KEY, JSON.stringify(state.order))
  } catch {
    /* localStorage 不可用(隐私模式/quota)时忽略 */
  }
}

function load(): { sessions: Record<string, Session>; order: string[] } | null {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_KEY)
    const orderRaw = localStorage.getItem(LS_ORDER_KEY)
    if (!raw) return null
    const sessions = JSON.parse(raw) as Record<string, Session>
    const order = orderRaw ? (JSON.parse(orderRaw) as string[]) : Object.keys(sessions)
    return { sessions, order }
  } catch {
    return null
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  order: [],
  currentId: null,
  inflight: false,

  hydrate: () => {
    const data = load()
    if (!data) return
    const sessions: Record<string, Session> = {}
    const order: string[] = []
    for (const id of data.order) {
      const s = data.sessions[id]
      if (!s) continue
      sessions[id] = {
        ...s,
        status: 'idle' as const,
        messages: s.messages.map((m) => ({ ...m, streaming: false }))
      }
      order.push(id)
    }
    set({ sessions, order, currentId: order[0] || null })
  },

  createSession: () => {
    const id = `session_${Date.now()}`
    const now = Date.now()
    const s: Session = {
      id,
      title: '新会话',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      messages: []
    }
    set((st) => ({
      sessions: { ...st.sessions, [id]: s },
      order: [id, ...st.order],
      currentId: id
    }))
    persist(get())
    return id
  },

  deleteSession: (id) => {
    set((st) => {
      const { [id]: _removed, ...rest } = st.sessions
      const order = st.order.filter((o) => o !== id)
      return {
        sessions: rest,
        order,
        currentId: st.currentId === id ? order[0] || null : st.currentId
      }
    })
    persist(get())
  },

  renameSession: (id, title) => {
    set((st) => {
      const s = st.sessions[id]
      if (!s) return st
      return {
        sessions: { ...st.sessions, [id]: { ...s, title, updatedAt: Date.now() } }
      }
    })
    persist(get())
  },

  selectSession: (id) => set({ currentId: id }),

  pushUserMessage: (text) => {
    const { currentId, sessions } = get()
    if (!currentId) return
    const s = sessions[currentId]
    if (!s) return
    const msg: Message = { id: genId(), role: 'user', content: text, ts: Date.now() }
    // 会话自动命名:首条消息前 30 字符为标题(AGENTS.md 约定)
    const title =
      s.title === '新会话' && s.messages.length === 0
        ? text.slice(0, 30)
        : s.title
    const updated: Session = {
      ...s,
      title,
      updatedAt: Date.now(),
      status: 'running',
      messages: [...s.messages, msg]
    }
    set((st) => ({ sessions: { ...st.sessions, [currentId]: updated }, inflight: true }))
    persist(get())
  },

  applyLlmEvent: (event) => {
    const { currentId, sessions } = get()
    if (!currentId) return
    const s = sessions[currentId]
    if (!s) return
    const msgs = [...s.messages]
    if (event.type === 'text') {
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + event.content }
      } else {
        msgs.push({
          id: genId(),
          role: 'assistant',
          content: event.content,
          ts: Date.now(),
          streaming: true
        })
      }
    } else if (event.type === 'turn_end') {
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, streaming: false }
    } else if (event.type === 'error') {
      msgs.push({
        id: genId(),
        role: 'assistant',
        content: event.message.includes('API') ? '⚠ API 连接失败' : `⚠ ${event.message}`,
        ts: Date.now()
      })
    } else if (event.type === 'interrupted') {
      msgs.push({ id: genId(), role: 'system', content: '--- 操作已终止 ---', ts: Date.now() })
    }
    const done =
      event.type === 'turn_end' || event.type === 'error' || event.type === 'interrupted'
    const updated: Session = {
      ...s,
      updatedAt: Date.now(),
      messages: msgs,
      status: done ? 'idle' : 'running'
    }
    set((st) => ({
      sessions: { ...st.sessions, [currentId]: updated },
      inflight: done ? false : st.inflight
    }))
    persist(get())
  },

  setInflight: (v) => set({ inflight: v })
}))
