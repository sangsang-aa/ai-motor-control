// 聊天主界面 — 从 Electron 版 src/renderer/src/App.tsx 迁移;
// window.api 事件订阅改为 bus(backendBus/llmBus),LLM 发送改为 llmClient + llmBus

'use client'

import React, { useEffect, useCallback } from 'react'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { ChatPane } from './ChatPane'
import { Composer } from './Composer'
import { DisconnectBanner } from './DisconnectBanner'
import { EStopButton } from './EStopButton'
import { CommandLockBanner } from './CommandLockBanner'
import { useSessionStore } from '@/lib/stores/sessionStore'
import { useMotorStore } from '@/lib/stores/motorStore'
import { useCommandLock } from '@/lib/stores/commandLockStore'
import { backendBus, llmBus } from '@/lib/bus'
import { sendMessage, abort as abortLlm } from '@/lib/llm/llmClient'

let _pendingToolCall: { name: string; args: Record<string, unknown> } | null = null
export function setPendingToolCall(n: string, a: Record<string, unknown>) {
  _pendingToolCall = { name: n, args: a }
}
export function consumePendingToolCall() {
  const pc = _pendingToolCall
  _pendingToolCall = null
  return pc
}

export const ChatApp: React.FC = () => {
  const { disconnectMessage, connected, applyEvent } = useMotorStore()
  const inflight = useSessionStore((s) => s.inflight)
  const lock = useCommandLock()

  useEffect(() => {
    const u1 = backendBus.on((e) => {
      applyEvent(e)
      if (e.type === 'executed') lock.unlock()
    })
    const u2 = llmBus.on((e) => {
      if (e.type === 'tool_call') {
        const store = useSessionStore.getState()
        const s = store.currentId ? store.sessions[store.currentId] : null
        if (s) {
          const msgs = s.messages.filter((m) => !(m.role === 'assistant' && m.streaming))
          if (msgs.length !== s.messages.length) {
            // 触发 ChatPane 重渲染的兜底(与 Electron 版一致)
            store.applyLlmEvent({ type: 'text', content: '' })
            store.applyLlmEvent({ type: 'turn_end' })
          }
        }
        if (lock.status !== 'idle') {
          store.applyLlmEvent({ type: 'text', content: '当前存在未确认的硬件操作，请等待处理' })
          return
        }
        if (e.toolName === 'get_status') {
          // get_status 自动执行,不需要人工确认
          import('@/lib/serial/motorController').then((m) => {
            const r = m.getStatus()
            store.applyLlmEvent({ type: 'text', content: `>> ${r}` })
          })
        } else {
          lock.lock(`call_${e.toolName}_${Date.now()}`)
          setPendingToolCall(e.toolName, e.arguments)
          useMotorStore.getState().notifyToolCall()
        }
      } else {
        useSessionStore.getState().applyLlmEvent(e)
      }
    })
    return () => {
      u1()
      u2()
    }
  }, [applyEvent, lock])

  // 启动时从 localStorage 恢复会话
  useEffect(() => {
    useSessionStore.getState().hydrate()
  }, [])

  const handleSend = useCallback(
    (text: string) => {
      if (lock.status !== 'idle') return
      const st = useSessionStore.getState()
      let cid = st.currentId
      if (!cid) {
        cid = st.createSession()
        st.selectSession(cid)
      }
      st.pushUserMessage(text)
      const history = st.sessions[cid]?.messages || []
      // LLM 事件经 llmBus 广播,由上面的订阅统一处理
      sendMessage(text, history, (e) => llmBus.emit(e)).catch(console.error)
    },
    [lock.status]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c' && (inflight || lock.status !== 'idle')) {
        e.preventDefault()
        abortLlm()
        llmBus.emit({ type: 'interrupted' })
        lock.unlock()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [inflight, lock])

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
