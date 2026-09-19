/**
 * commandLockStore 单测 — 覆盖 idle→pending→executing→idle 状态机与 setExecuting 守卫。
 * 仅测试,不修改 commandLockStore.ts(见整改提案 P1b)。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCommandLock } from '@/lib/stores/commandLockStore'

beforeEach(() => {
  useCommandLock.setState({ status: 'idle', toolCallId: '', lockedAt: 0 })
})

describe('commandLockStore', () => {
  it('初始态:idle / 空 id / lockedAt=0', () => {
    const st = useCommandLock.getState()
    expect(st.status).toBe('idle')
    expect(st.toolCallId).toBe('')
    expect(st.lockedAt).toBe(0)
  })

  it('lock → pending,记录 toolCallId 与 lockedAt', () => {
    const before = Date.now()
    useCommandLock.getState().lock('tc1')
    const st = useCommandLock.getState()
    expect(st.status).toBe('pending')
    expect(st.toolCallId).toBe('tc1')
    expect(st.lockedAt).toBeGreaterThanOrEqual(before)
  })

  it('pending → executing', () => {
    useCommandLock.getState().lock('tc1')
    useCommandLock.getState().setExecuting()
    expect(useCommandLock.getState().status).toBe('executing')
  })

  it('守卫:idle 时 setExecuting 无效', () => {
    useCommandLock.getState().setExecuting()
    expect(useCommandLock.getState().status).toBe('idle')
  })

  it('守卫:executing 时 setExecuting 幂等', () => {
    useCommandLock.getState().lock('tc1')
    useCommandLock.getState().setExecuting()
    useCommandLock.getState().setExecuting()
    expect(useCommandLock.getState().status).toBe('executing')
  })

  it('unlock 复位到 idle', () => {
    useCommandLock.getState().lock('tc1')
    useCommandLock.getState().setExecuting()
    useCommandLock.getState().unlock()
    const st = useCommandLock.getState()
    expect(st.status).toBe('idle')
    expect(st.toolCallId).toBe('')
    expect(st.lockedAt).toBe(0)
  })

  it('完整链路:idle → pending → executing → idle', () => {
    const s = () => useCommandLock.getState().status
    expect(s()).toBe('idle')
    useCommandLock.getState().lock('tc')
    expect(s()).toBe('pending')
    useCommandLock.getState().setExecuting()
    expect(s()).toBe('executing')
    useCommandLock.getState().unlock()
    expect(s()).toBe('idle')
  })

  it('重新 lock 覆盖上一个 toolCallId', () => {
    useCommandLock.getState().lock('a')
    useCommandLock.getState().lock('b')
    const st = useCommandLock.getState()
    expect(st.status).toBe('pending')
    expect(st.toolCallId).toBe('b')
  })
})
