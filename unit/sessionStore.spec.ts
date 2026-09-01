/**
 * 会话 store 单测(sessionStore.ts)— 验证:
 * 1) 会话创建/删除/重命名/切换;2) 首条消息自动命名(pushUserMessage);
 * 3) applyLlmEvent 流式追加/error/interrupted 状态流转;4) localStorage 持久化。
 * 对应测试点:对话能够正常记录。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '@/lib/stores/sessionStore'

beforeEach(() => {
  localStorage.clear()
  useSessionStore.setState({ sessions: {}, order: [], currentId: null, inflight: false })
})

describe('sessionStore', () => {
  it('creates and selects a session', () => {
    const id = useSessionStore.getState().createSession()
    const st = useSessionStore.getState()
    expect(st.currentId).toBe(id)
    expect(st.sessions[id].title).toBe('新会话')
  })

  it('auto-names session from first user message (首条消息前30字符)', () => {
    useSessionStore.getState().createSession()
    const st = useSessionStore.getState()
    const cid = st.currentId!
    useSessionStore.getState().pushUserMessage('帮我加速到三千转谢谢')
    const s = useSessionStore.getState().sessions[cid]
    expect(s.title).toBe('帮我加速到三千转谢谢'.slice(0, 30))
    expect(s.messages).toHaveLength(1)
    expect(s.status).toBe('running')
  })

  it('applies LLM streaming text and settles to idle on turn_end', () => {
    useSessionStore.getState().createSession()
    const cid = useSessionStore.getState().currentId!
    useSessionStore.getState().applyLlmEvent({ type: 'text', content: '你好' })
    useSessionStore.getState().applyLlmEvent({ type: 'text', content: '世界' })
    useSessionStore.getState().applyLlmEvent({ type: 'turn_end' })
    const s = useSessionStore.getState().sessions[cid]
    expect(s.messages).toHaveLength(1)
    expect(s.messages[0].content).toBe('你好世界')
    expect(s.messages[0].streaming).toBe(false)
    expect(s.status).toBe('idle')
  })

  it('appends error and interrupted as messages', () => {
    useSessionStore.getState().createSession()
    const cid = useSessionStore.getState().currentId!
    useSessionStore.getState().applyLlmEvent({ type: 'error', message: 'API timeout' })
    useSessionStore.getState().applyLlmEvent({ type: 'interrupted' })
    const s = useSessionStore.getState().sessions[cid]
    expect(s.messages.length).toBe(2)
    expect(s.messages[1].role).toBe('system')
  })

  it('persists to localStorage', () => {
    useSessionStore.getState().createSession()
    const st = useSessionStore.getState()
    const cid = st.currentId!
    useSessionStore.getState().pushUserMessage('测试持久化')
    const raw = localStorage.getItem('mototune.sessions')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)[cid].title).toBe('测试持久化'.slice(0, 30))
  })

  it('hydrates from localStorage back into state', () => {
    useSessionStore.getState().createSession()
    useSessionStore.getState().pushUserMessage('恢复我')
    // 清空内存态,再 hydrate(模拟刷新)
    useSessionStore.setState({ sessions: {}, order: [], currentId: null, inflight: false })
    useSessionStore.getState().hydrate()
    const st = useSessionStore.getState()
    expect(st.order.length).toBe(1)
    expect(Object.keys(st.sessions).length).toBe(1)
  })

  it('deletes and switches current session', () => {
    const a = useSessionStore.getState().createSession()
    const b = useSessionStore.getState().createSession()
    useSessionStore.getState().deleteSession(a)
    const st = useSessionStore.getState()
    expect(st.sessions[a]).toBeUndefined()
    expect(st.currentId).toBe(b)
  })
})
