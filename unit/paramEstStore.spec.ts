import { describe, it, expect, beforeEach } from 'vitest'
import { useParamEstStore, DEFAULT_CONFIG, DEFAULT_CONTROL } from '@/lib/stores/paramEstStore'

const reset = () =>
  useParamEstStore.setState({
    connected: false,
    port: '',
    baudRate: 0,
    frames: 0,
    blocks: 0,
    bytes: 0,
    acquiring: false,
    result: null,
    quality: null,
    waveform: null,
    dataError: null,
    errorMessage: null,
    config: { ...DEFAULT_CONFIG },
    control: { ...DEFAULT_CONTROL }
  })

const okQuality = { ok: true, complete: true, valid: true, frames: 600, blocks: 1 }

describe('paramEstStore', () => {
  beforeEach(reset)

  it('pe_status 更新连接态', () => {
    useParamEstStore.getState().applyEvent({ type: 'pe_status', connected: true, port: 'USB:0451:bef3', baudRate: 12e6 })
    const s = useParamEstStore.getState()
    expect(s.connected).toBe(true)
    expect(s.port).toBe('USB:0451:bef3')
    expect(s.baudRate).toBe(12e6)
  })

  it('pe_progress 更新采集进度并置采集中', () => {
    useParamEstStore.getState().applyEvent({ type: 'pe_progress', frames: 120, blocks: 0, bytes: 1440 })
    const s = useParamEstStore.getState()
    expect(s.frames).toBe(120)
    expect(s.acquiring).toBe(true)
  })

  it('pe_result 写入辨识结果', () => {
    useParamEstStore.getState().applyEvent({ type: 'pe_result', result: { Rs: 0.13 }, quality: okQuality })
    const s = useParamEstStore.getState()
    expect(s.result?.Rs).toBeCloseTo(0.13, 6)
    expect(s.acquiring).toBe(false)
    expect(s.dataError).toBeNull()
  })

  it('多次 pe_result 累积不同参数(先 Rs 后 Ld)', () => {
    useParamEstStore.getState().applyEvent({ type: 'pe_result', result: { Rs: 0.13 }, quality: okQuality })
    useParamEstStore.getState().applyEvent({ type: 'pe_result', result: { Ld: 1.2e-4 }, quality: okQuality })
    const s = useParamEstStore.getState()
    expect(s.result?.Rs).toBeCloseTo(0.13, 6)
    expect(s.result?.Ld).toBeCloseTo(1.2e-4, 9)
  })

  it('pe_data_error 置「出现数据错误」', () => {
    useParamEstStore.getState().applyEvent({ type: 'pe_data_error', message: '出现数据错误' })
    expect(useParamEstStore.getState().dataError).toBe('出现数据错误')
  })

  it('setControl / setTest / setConfigValue', () => {
    const st = useParamEstStore.getState()
    st.setControl({ enable: true })
    st.setTest(3)
    st.setConfigValue('P', 7)
    const s = useParamEstStore.getState()
    expect(s.control.enable).toBe(true)
    expect(s.control.test).toBe(3)
    expect(s.config.P).toBe(7)
  })

  it('beginAcquisition 重置进度,但保留已得结果', () => {
    useParamEstStore.setState({ result: { Rs: 0.13, Ld: NaN, Lq: NaN, Ke: NaN, J: NaN, B: NaN }, frames: 999 })
    useParamEstStore.getState().beginAcquisition()
    const s = useParamEstStore.getState()
    expect(s.acquiring).toBe(true)
    expect(s.frames).toBe(0)
    expect(s.result?.Rs).toBeCloseTo(0.13, 6)
  })

  it('clearResults 清空结果', () => {
    useParamEstStore.setState({ result: { Rs: 1, Ld: 1, Lq: 1, Ke: 1, J: 1, B: 1 } })
    useParamEstStore.getState().clearResults()
    expect(useParamEstStore.getState().result).toBeNull()
  })
})
