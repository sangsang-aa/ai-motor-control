import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Session, Message } from '../shared/types'

const DATA_FILE = join(app.getPath('userData'), 'sessions.json')

export class SessionManager {
  private sessions: Session[] = []
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() { this.load(); this.ensureDefault() }

  list(): Session[] { return this.sessions }
  get(id: string): Session | undefined { return this.sessions.find(s => s.id === id) }

  upsert(session: Session): void {
    const idx = this.sessions.findIndex(s => s.id === session.id)
    if (idx >= 0) this.sessions[idx] = session
    else this.sessions.unshift(session)
    this.debounceSave()
  }

  delete(id: string): void {
    this.sessions = this.sessions.filter(s => s.id !== id)
    this.save()
  }

  rename(id: string, title: string): void {
    const s = this.sessions.find(s => s.id === id)
    if (s) { s.title = title; s.updatedAt = Date.now(); this.debounceSave() }
  }

  /** Call on every message change — debounced 1s save */
  touch(): void { this.debounceSave() }

  private ensureDefault(): void {
    if (this.sessions.length === 0) {
      const now = Date.now()
      this.sessions = [{
        id: `session_${now}`, title: '新会话', createdAt: now, updatedAt: now,
        status: 'idle', messages: []
      }]
      this.save()
    }
  }

  private debounceSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 1000)
  }

  private load(): void {
    if (!existsSync(DATA_FILE)) return
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8')
      const data = JSON.parse(raw)
      this.sessions = (data.sessions || []).map(normalizeSession)
    } catch { this.sessions = [] }
  }

  private save(): void {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmp = DATA_FILE + '.tmp.' + process.pid + '.' + Date.now()
    writeFileSync(tmp, JSON.stringify({ version: 1, sessions: this.sessions }, null, 2), 'utf-8')
    try { renameSync(tmp, DATA_FILE) } catch {
      writeFileSync(DATA_FILE, JSON.stringify({ version: 1, sessions: this.sessions }), 'utf-8')
      if (existsSync(tmp)) unlinkSync(tmp)
    }
  }
}

function normalizeSession(raw: Record<string, unknown>): Session {
  return {
    id: String(raw.id || `session_${Date.now()}`),
    title: String(raw.title || '新会话'),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    status: 'idle' as Session['status'],
    messages: Array.isArray(raw.messages) ? raw.messages.map(normalizeMessage) : []
  }
}
function normalizeMessage(raw: Record<string, unknown>): Message {
  return {
    id: String(raw.id || ''), role: (raw.role as Message['role']) || 'user',
    content: String(raw.content || ''), ts: Number(raw.ts) || Date.now(),
    streaming: Boolean(raw.streaming)
  }
}
