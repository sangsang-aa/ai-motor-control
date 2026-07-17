import React, { useEffect, useCallback } from 'react'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { ChatPane } from './components/ChatPane'
import { Composer } from './components/Composer'
import { DisconnectBanner } from './components/DisconnectBanner'
import { EStopButton } from './components/EStopButton'
import { CommandLockBanner } from './components/CommandLockBanner'
import { useSessionStore } from './store/sessionStore'
import { useMotorStore } from './store/motorStore'
import { useCommandLock } from './store/commandLockStore'

let _pendingToolCall: { name: string; args: Record<string, unknown> } | null = null
export function setPendingToolCall(n: string, a: Record<string, unknown>) { _pendingToolCall = { name: n, args: a } }
export function consumePendingToolCall() { const pc = _pendingToolCall; _pendingToolCall = null; return pc }

const App: React.FC = () => {
  const { disconnectMessage, connected, applyEvent } = useMotorStore()
  const inflight = useSessionStore(s => s.inflight)
  const lock = useCommandLock()

  useEffect(() => {
    const u1 = window.api.onBackendEvent(e => {
      applyEvent(e)
      if (e.type === 'executed') lock.unlock()
    })
    const u2 = window.api.onLlmEvent(e => {
      if (e.type === 'tool_call') {
        const store = useSessionStore.getState()
        const s = store.currentId ? store.sessions[store.currentId] : null
        if (s) {
          const hasStreaming = s.messages.some(m => m.role === 'assistant' && m.streaming)
          if (hasStreaming) {
            store.applyLlmEvent({ type: 'turn_end' })
          }
        }
        if (lock.status !== 'idle') {
          store.applyLlmEvent({ type: 'text', content: '当前存在未确认的硬件操作，请等待处理' })
          return
        }
        if (e.toolName === 'get_status') {
          window.api.sendCommand('get_status', e.arguments).then(r =>
            store.applyLlmEvent({ type: 'text', content: `>> ${r}` })
          ).catch(console.error)
        } else {
          lock.lock(`call_${e.toolName}_${Date.now()}`)
          setPendingToolCall(e.toolName, e.arguments)
          useMotorStore.getState().notifyToolCall()
        }
      } else { useSessionStore.getState().applyLlmEvent(e) }
    })
    return () => { u1(); u2() }
  }, [applyEvent, lock])

  // No auto-connect on startup
  useEffect(() => { window.api.listSessions().then(l => useSessionStore.getState().hydrate(l)).catch(console.error) }, [])

  const handleSend = useCallback((text: string) => {
    if (lock.status !== 'idle') return
    const st = useSessionStore.getState(); let cid = st.currentId
    if (!cid) { cid = st.createSession(); st.selectSession(cid) }
    st.pushUserMessage(text)
    window.api.sendMessage(text, st.sessions[cid]?.messages || []).catch(console.error)
  }, [lock.status])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c' && (inflight || lock.status !== 'idle')) {
        e.preventDefault(); window.api.interrupt().catch(console.error); lock.unlock()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [inflight, lock])

  useEffect(() => {
    if (!inflight && lock.status === 'idle') return
    const t = setTimeout(() => {
      useSessionStore.getState().setInflight(false)
      lock.unlock()
    }, 30000)
    return () => clearTimeout(t)
  }, [inflight, lock.status])

  return (
    <div className="h-full flex flex-col" style={{ background: '#0a1628' }}>
      <Topbar />
      {lock.status !== 'idle' && <CommandLockBanner />}
      {disconnectMessage && !connected && <DisconnectBanner />}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPane />
          <Composer onSend={handleSend} disabled={inflight || lock.status !== 'idle'} locked={lock.status !== 'idle'} />
        </div>
      </div>
      <EStopButton onEStop={() => lock.unlock()} />
    </div>
  )
}
export default App
