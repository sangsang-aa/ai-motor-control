import React, { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { useMotorStore } from '../store/motorStore'
import { ConfirmCard } from './ConfirmCard'
import { consumePendingToolCall } from '../App'
import { useCommandLock } from '../store/commandLockStore'

const TIMEOUT = 30000

export const ChatPane: React.FC = () => {
  const { sessions, currentId, inflight } = useSessionStore()
  const toolCallVersion = useMotorStore(s => s.toolCallVersion)
  const sr = useRef<HTMLDivElement>(null)
  const [pt, setPt] = useState<{ name: string; args: Record<string, unknown> } | null>(null)
  const [expired, setExpired] = useState(false)
  const tr = useRef<ReturnType<typeof setTimeout>>()
  const lock = useCommandLock()
  const session = currentId ? sessions[currentId] : undefined
  const msgs = session?.messages || []

  useEffect(() => { if (sr.current) sr.current.scrollTop = sr.current.scrollHeight }, [msgs.length, msgs[msgs.length - 1]?.content])

  useEffect(() => {
    const pc = consumePendingToolCall()
    if (pc) { setPt(pc); setExpired(false); tr.current = setTimeout(() => { setExpired(true); setPt(null); lock.unlock() }, TIMEOUT) }
    return () => { if (tr.current) clearTimeout(tr.current) }
  }, [msgs.length, toolCallVersion])

  const confirm = async () => {
    if (!pt) return; if (tr.current) clearTimeout(tr.current)
    lock.setExecuting()
    try { const r = await window.api.sendCommand(pt.name, pt.args); useSessionStore.getState().applyLlmEvent({ type: 'text', content: `${r}` }) }
    catch (e) { useSessionStore.getState().applyLlmEvent({ type: 'error', message: `执行失败: ${e}` }); lock.unlock() }
    setPt(null)
  }
  const ignore = () => { if (tr.current) clearTimeout(tr.current); setPt(null); lock.unlock() }
  const rc = (r: string) => r === 'user' ? 'user' : r === 'assistant' ? 'asst' : 'sys'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={sr} className="chat-scroll">
        {msgs.length === 0 && !inflight && (
          <div className="welcome"><div className="t" style={{fontSize:32,fontWeight:800,letterSpacing:'0.08em'}}>MOTOTUNE</div><div className="h" style={{fontSize:16,marginTop:12}}>您好，今天要干什么？</div></div>
        )}
        {msgs.map(m => <div key={m.id} className={`msg-row ${rc(m.role)}`}><div className={`msg-bbl ${rc(m.role)}`}>{m.content}{m.streaming && <span className="stream-dot" />}</div></div>)}
        {pt && !expired && <ConfirmCard toolName={pt.name} arguments={pt.args} onConfirm={confirm} onIgnore={ignore} timeout={TIMEOUT} />}
        {pt && expired && <div className="text-center text-fg-muted text-xs py-2">指令确认已超时，已取消</div>}
        {inflight && !pt && <div className="think-dots"><span /><span /><span /></div>}
      </div>
    </div>
  )
}
