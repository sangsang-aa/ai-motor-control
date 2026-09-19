/**
 * motorStore 单测 — 覆盖 applyEvent 各事件分派、掉线清空、telemetry 追加/截断、
 * wave_frame 转发、error 告警、updateStatus、notifyToolCall。
 * 仅测试,不修改 motorStore.ts(见整改提案 P1a)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMotorStore } from '@/lib/stores/motorStore'
import { useScopeStore } from '@/lib/stores/scopeStore'

const INITIAL = {
  status: { connected: false, port: '', baudRate: 0, rpm: 0, currentIa: 0, alarmInfo: '' },
  rpmHistory: [] as number[],
  currentHistory: [] as number[],
  connected: false,
  disconnectMessage: false,
  toolCallVersion: 0
}

beforeEach(() => {
  useMotorStore.setState({ ...INITIAL, status: { ...INITIAL.status } })
  vi.restoreAllMocks()
})

describe('motorStore 初始态', () => {
  it('初始字段符合预期', () => {
    const st = useMotorStore.getState()
    expect(st.connected).toBe(false)
    expect(st.status).toEqual({ connected: false, port: '', baudRate: 0, rpm: 0, currentIa: 0, alarmInfo: '' })
    expect(st.rpmHistory).toEqual([])
    expect(st.currentHistory).toEqual([])
    expect(st.disconnectMessage).toBe(false)
    expect(st.toolCallVersion).toBe(0)
  })
})

describe('motorStore serial_status', () => {
  it('连接:connected=true、port 正确、alarmInfo 清空', () => {
    useMotorStore.setState({ status: { ...INITIAL.status, alarmInfo: '旧告警' } })
    useMotorStore.getState().applyEvent({ type: 'serial_status', connected: true, port: 'USB:2345:6789' })
    const st = useMotorStore.getState()
    expect(st.connected).toBe(true)
    expect(st.status.connected).toBe(true)
    expect(st.status.port).toBe('USB:2345:6789')
    expect(st.status.alarmInfo).toBe('')
    expect(st.disconnectMessage).toBe(false)
  })

  it('掉线:rpm/currentIa=0、history 清空、resetBuffers 被调用一次', () => {
    useMotorStore.setState({
      connected: true,
      rpmHistory: [1, 2],
      currentHistory: [3],
      status: { ...INITIAL.status, connected: true, rpm: 1234, currentIa: 5.5 }
    })
    const spy = vi.spyOn(useScopeStore.getState(), 'resetBuffers')
    useMotorStore.getState().applyEvent({ type: 'serial_status', connected: false, port: '' })
    const st = useMotorStore.getState()
    expect(st.connected).toBe(false)
    expect(st.status.rpm).toBe(0)
    expect(st.status.currentIa).toBe(0)
    expect(st.rpmHistory).toEqual([])
    expect(st.currentHistory).toEqual([])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('掉线不覆写 disconnectMessage(保留原值)', () => {
    useMotorStore.getState().applyEvent({ type: 'error', message: 'boom' })
    expect(useMotorStore.getState().disconnectMessage).toBe(true)
    useMotorStore.getState().applyEvent({ type: 'serial_status', connected: false, port: '' })
    expect(useMotorStore.getState().disconnectMessage).toBe(true)
  })
})

describe('motorStore telemetry', () => {
  it('有 series:标量取 rpm/current,history 整段追加', () => {
    useMotorStore.getState().applyEvent({
      type: 'telemetry',
      rpm: 2000,
      current: 3.5,
      seriesRpm: [1000, 2000, 3000],
      seriesIa: [1, 2, 3.5]
    })
    const st = useMotorStore.getState()
    expect(st.status.rpm).toBe(2000)
    expect(st.status.currentIa).toBe(3.5)
    expect(st.rpmHistory).toEqual([1000, 2000, 3000])
    expect(st.currentHistory).toEqual([1, 2, 3.5])
  })

  it('空 series:回退到 [rpm]/[current] 各追加 1 条', () => {
    useMotorStore.getState().applyEvent({
      type: 'telemetry',
      rpm: 800,
      current: 1.25,
      seriesRpm: [],
      seriesIa: []
    })
    const st = useMotorStore.getState()
    expect(st.rpmHistory).toEqual([800])
    expect(st.currentHistory).toEqual([1.25])
  })

  it('MAX_HISTORY 截断到 6000', () => {
    useMotorStore.setState({ rpmHistory: Array(6000).fill(1) })
    useMotorStore.getState().applyEvent({
      type: 'telemetry',
      rpm: 9,
      current: 9,
      seriesRpm: [9],
      seriesIa: [9]
    })
    expect(useMotorStore.getState().rpmHistory.length).toBe(6000)
  })
})

describe('motorStore wave_frame / error / 工具', () => {
  it('wave_frame 转发给 scopeStore.enqueueWaveFrame(samples, 当前 rpm, batch)', () => {
    useMotorStore.setState({ status: { ...INITIAL.status, rpm: 0 } })
    const spy = vi.spyOn(useScopeStore.getState(), 'enqueueWaveFrame')
    useMotorStore.getState().applyEvent({ type: 'wave_frame', batch: 7, samples: [1, 2, 3] })
    expect(spy).toHaveBeenCalledWith([1, 2, 3], 0, 7)
  })

  it('error:disconnectMessage=true 且 alarmInfo=message', () => {
    useMotorStore.getState().applyEvent({ type: 'error', message: 'boom' })
    const st = useMotorStore.getState()
    expect(st.disconnectMessage).toBe(true)
    expect(st.status.alarmInfo).toBe('boom')
  })

  it('updateStatus 整体替换', () => {
    const next = { connected: true, port: 'P1', baudRate: 781250, rpm: 50, currentIa: 0.1, alarmInfo: 'x' }
    useMotorStore.getState().updateStatus(next)
    expect(useMotorStore.getState().status).toEqual(next)
  })

  it('notifyToolCall 递增 toolCallVersion', () => {
    expect(useMotorStore.getState().toolCallVersion).toBe(0)
    useMotorStore.getState().notifyToolCall()
    useMotorStore.getState().notifyToolCall()
    expect(useMotorStore.getState().toolCallVersion).toBe(2)
  })
})
