import { describe, it, expect, beforeEach } from 'vitest'
import { useMotorStore } from '@/lib/stores/motorStore'
import { useScopeStore, AI_SAMPLE_TIME_S } from '@/lib/stores/scopeStore'
import type { Model, Sample } from '@/lib/serial/aimotor/protocol'

function sample(patch: Partial<Sample> = {}): Sample {
  return {
    tick: 1, mode: 6, stage: 3, flags: 1, error: 0,
    reference: 1500, speed: 1480, id_ref: 0, id: 0.1, iq_ref: 0.5, iq: 0.48,
    iu: 0.5, iv: -0.25, iw: -0.25, angle: 0.5, emf: 1.2, if_speed: 0,
    ...patch
  }
}

const model: Model = {
  rs: 0.1943, ld: 89.6e-6, lq: 91.5e-6, ls: 90.55e-6, bandwidth: 500,
  kp_d: 0.02346, ki_d: 0.001017, kp_q: 0.02396, ki_q: 0.001017, bus: 24,
  pole_pairs: 5, status: 0, hfi_status: 4, select: 1, applied: 1,
  save_status: 3, saved_valid: 1, ident_error: 0, revision: 1,
  rx_frames: 0, crc_errors: 0, dropped_samples: 0, sci_errors: 0
}

beforeEach(() => {
  useMotorStore.setState({
    connected: false,
    status: { connected: false, port: '', baudRate: 0, rpm: 0, currentIa: 0, alarmInfo: '' },
    rpmHistory: [],
    currentHistory: [],
    disconnectMessage: false,
    mode: 0,
    stage: 0,
    flags: 0,
    errorCode: 0,
    reference: 0,
    model: null,
    config: []
  })
  useScopeStore.setState({ paused: false, filled: 0 })
  useScopeStore.getState().initAiChannels()
})

describe('AI-Motor 状态映射', () => {
  it('status/sample/model/config 落到 motorStore', () => {
    const m = useMotorStore.getState()
    m.applyEvent({ type: 'ai_status', connected: true, port: 'USB:0451:BEF3', baudRate: 115200 })
    expect(useMotorStore.getState().connected).toBe(true)
    expect(useMotorStore.getState().status.baudRate).toBe(115200)

    m.applyEvent({ type: 'ai_sample', sample: sample() })
    const st = useMotorStore.getState()
    expect(st.status.rpm).toBe(1480)
    expect(st.status.currentIa).toBe(0.5)
    expect(st.mode).toBe(6)
    expect(st.stage).toBe(3)
    expect(st.reference).toBe(1500)

    m.applyEvent({ type: 'ai_model', model })
    expect(useMotorStore.getState().model?.rs).toBeCloseTo(0.1943)

    m.applyEvent({ type: 'ai_config', records: [{ param: 1, mode: 6, integer: 0, value: 1500 }] })
    expect(useMotorStore.getState().config[0].value).toBe(1500)
  })

  it('ai_error 写入告警;ai_closed 置未连接', () => {
    const m = useMotorStore.getState()
    m.applyEvent({ type: 'ai_error', message: '握手失败' })
    expect(useMotorStore.getState().disconnectMessage).toBe(true)
    expect(useMotorStore.getState().status.alarmInfo).toBe('握手失败')

    m.applyEvent({ type: 'ai_status', connected: true, port: 'p', baudRate: 115200 })
    m.applyEvent({ type: 'ai_closed' })
    expect(useMotorStore.getState().connected).toBe(false)
  })
})

describe('示波器 100Hz 缓冲', () => {
  it('初始化 6 个 AI 通道', () => {
    const s = useScopeStore.getState()
    expect(s.channels).toHaveLength(6)
    expect(s.ts).toBe(AI_SAMPLE_TIME_S)
    expect(s.channels[0].name).toContain('Iu')
    expect(s.channels[1].name).toContain('Speed')
  })

  it('appendAiSample 写入 Iu/Speed/Id/Iq/EMF/I-F', () => {
    useScopeStore.getState().appendAiSample(sample())
    const st = useScopeStore.getState()
    expect(st.filled).toBe(1)
    const last = st.n - 1
    expect(st.buffers[0][last]).toBeCloseTo(0.5)
    expect(st.buffers[1][last]).toBeCloseTo(1480)
    expect(st.buffers[2][last]).toBeCloseTo(0.1)
    expect(st.buffers[3][last]).toBeCloseTo(0.48)
    expect(st.buffers[4][last]).toBeCloseTo(1.2)
    expect(st.buffers[5][last]).toBeCloseTo(0)
  })

  it('暂停时不追加', () => {
    useScopeStore.setState({ paused: true })
    useScopeStore.getState().appendAiSample(sample())
    expect(useScopeStore.getState().filled).toBe(0)
  })
})
