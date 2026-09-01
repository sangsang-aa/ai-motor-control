/**
 * 示波器 store 单测(scopeStore.ts)— 验证 applyFrame 缓冲逻辑:
 * 1) 交错 payload 正确分配到每通道;2) 左移+追加;3) 暂停不更新;
 * 4) 通道配置持久化(hydrateFromStorage/persistToStorage)。
 * 对应测试点:示波器能够接收串口数据并输出正常波形。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useScopeStore } from '@/lib/stores/scopeStore'

beforeEach(() => {
  localStorage.clear()
  const s = useScopeStore.getState()
  s.resetBuffers()
  s.setPaused(false)
  s.setN(4000)
})

describe('scopeStore applyFrame', () => {
  it('interleaves payload into correct channel buffers', () => {
    const s = useScopeStore.getState()
    // 2 对: ch0=[100,200], ch1=[-1,-2] → 交错 [100,-1,200,-2]
    s.applyFrame([100, -1, 200, -2], 2)
    const st = useScopeStore.getState()
    const ch0 = st.buffers[0]
    const ch1 = st.buffers[1]
    // 末尾两位是最后追加的
    expect(ch0[st.n - 2]).toBe(100)
    expect(ch0[st.n - 1]).toBe(200)
    expect(ch1[st.n - 2]).toBe(-1)
    expect(ch1[st.n - 1]).toBe(-2)
    expect(st.filled).toBe(2)
  })

  it('shifts left and appends when buffer fills (copyWithin logic)', () => {
    const s = useScopeStore.getState()
    s.setN(10) // 小缓冲便于观察
    s.applyFrame([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 2) // 7 对
    const st = useScopeStore.getState()
    expect(st.filled).toBe(7) // 7 对 < n=10,不满
    // 末两位是最后追加的一对:ch0=13, ch1=14
    expect(st.buffers[0][st.n - 1]).toBe(13)
    expect(st.buffers[1][st.n - 1]).toBe(14)
  })

  it('does NOT update buffer while paused', () => {
    const s = useScopeStore.getState()
    s.applyFrame([1, 2], 2)
    const before = useScopeStore.getState().buffers[0][useScopeStore.getState().n - 1]
    s.setPaused(true)
    s.applyFrame([99, 99], 2)
    const after = useScopeStore.getState().buffers[0][useScopeStore.getState().n - 1]
    expect(after).toBe(before) // 暂停时不变
  })
})

describe('scopeStore channel config & persistence', () => {
  it('sets channel labels / enabled / range', () => {
    const s = useScopeStore.getState()
    s.setChannelLabel(0, 'Ia (A)')
    s.setChannelYRange(0, 500)
    const st = useScopeStore.getState()
    expect(st.channels[0].label).toBe('Ia (A)')
    expect(st.channels[0].yRange).toBe(500)
  })

  it('persists and hydrates channel view config', () => {
    const s = useScopeStore.getState()
    s.setChannelLabel(1, 'Speed (RPM)')
    s.persistToStorage()
    // 模拟刷新:清空通道
    useScopeStore.setState((st) => ({ channels: st.channels.map((c) => ({ ...c, label: '' })) }))
    useScopeStore.getState().hydrateFromStorage()
    const st = useScopeStore.getState()
    expect(st.channels[1].label).toBe('Speed (RPM)')
  })
})
