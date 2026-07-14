import React, { useEffect, useCallback } from 'react'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { ChatPane } from './components/ChatPane'
import { Composer } from './components/Composer'
import { DisconnectBanner } from './components/DisconnectBanner'
import { EStopButton } from './components/EStopButton'
import { useSessionStore } from './store/sessionStore'
import { useMotorStore } from './store/motorStore'

let _pendingToolCall: { name: string; args: Record<string, unknown> } | null = null
export function setPendingToolCall(n: string, a: Record<string, unknown>) { _pendingToolCall = { name: n, args: a } }
export function consumePendingToolCall() { const pc = _pendingToolCall; _pendingToolCall = null; return pc }

const App: React.FC = () => {
  const { disconnectMessage, connected, applyEvent } = useMotorStore()
  const inflight = useSessionStore(s => s.inflight)

  // Backend + LLM events
  useEffect(() => {
    const u1 = window.api.onBackendEvent(e => applyEvent(e))
    const u2 = window.api.onLlmEvent(e => {
      if (e.type === 'tool_call') {
        const store = useSessionStore.getState()
        const s = store.currentId ? store.sessions[store.currentId] : null
        if (s) {
          const msgs = s.messages.filter(m => !(m.role === 'assistant' && m.streaming))
          if (msgs.length !== s.messages.length) {
            store.applyLlmEvent({ type: 'turn_end' })
          }
        }
        if (e.toolName === 'get_status') {
          window.api.sendCommand('get_status', e.arguments).then(r => useSessionStore.getState().applyLlmEvent({ type: 'text', content: `>> ${r}` })).catch(console.error)
        } else { setPendingToolCall(e.toolName, e.arguments) }
      } else { useSessionStore.getState().applyLlmEvent(e) }
    })
    return () => { u1(); u2() }
  }, [applyEvent])

  // Ctrl+C global interrupt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c' && inflight) {
        e.preventDefault()
        window.api.interrupt().catch(console.error)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [inflight])

  useEffect(() => { window.api.startBackend().catch(console.error); return () => { window.api.stopBackend().catch(() => {}) } }, [])
  useEffect(() => { window.api.listSessions().then(l => useSessionStore.getState().hydrate(l)).catch(console.error) }, [])

  const handleSend = useCallback((text: string) => {
    const st = useSessionStore.getState(); let cid = st.currentId
    if (!cid) { cid = st.createSession(); st.selectSession(cid) }
    st.pushUserMessage(text)
    window.api.sendMessage(text, st.sessions[cid]?.messages || []).catch(console.error)
  }, [])

  return (
    <div className="h-full flex flex-col" style={{ background: '#0a1628' }}>
      <Topbar />
      {disconnectMessage && !connected && <DisconnectBanner />}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPane />
          <Composer onSend={handleSend} disabled={inflight} />
        </div>
      </div>
      <EStopButton />
    </div>
  )
}
export default App
