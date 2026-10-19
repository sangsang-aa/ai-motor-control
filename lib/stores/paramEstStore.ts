// 参数辨识状态(zustand) —— 只 applyEvent + 保存配置/控制字;串口动作由组件调用 controller。

import { create } from 'zustand'
import type {
  ControlWord,
  DataQualityReport,
  ParamEstConfig,
  ParamEstEvent,
  ParamEstResult,
  PmTestId
} from '../types'

/** 默认配置器参数(命令 1..21;未知项置 0,页面可编辑) */
export const DEFAULT_CONFIG: ParamEstConfig = {
  P: 5,
  NRated: 3000,
  IRated: 16.26,
  ImaxInverter: 0,
  RBoard: 0.0043,
  ISenseGain: 0.0105,
  VSenseGain: 0.0098,
  Ts: 50e-6,
  FreqMax: 0,
  FreqMin: 0,
  FreqStepSweep: 0,
  FreqStepEst: 0,
  FreqNum: 0,
  KeTime: 0,
  KeSpeed: 0,
  KpKiInputEnable: 1,
  Kp: 0,
  Ki: 0,
  IqRefFoc: 0,
  JSpeedLow: 0,
  CurrMeasDelay: 0
}

export const DEFAULT_CONTROL: ControlWord = {
  enable: false,
  auto: true,
  test: 0,
  debug: 1
}

interface ParamEstState {
  connected: boolean
  port: string
  baudRate: number
  /** 采集进度 */
  frames: number
  blocks: number
  bytes: number
  /** 是否正在采集(收到 progress 即视为采集中,直到结果/错误) */
  acquiring: boolean
  result: ParamEstResult | null
  quality: DataQualityReport | null
  waveform: { a: number[]; b: number[] } | null
  /** 「出现数据错误」提示 */
  dataError: string | null
  /** 连接/串口错误 */
  errorMessage: string | null
  config: ParamEstConfig
  control: ControlWord

  applyEvent: (e: ParamEstEvent) => void
  setControl: (patch: Partial<ControlWord>) => void
  setConfigValue: (name: keyof ParamEstConfig, value: number) => void
  setTest: (test: PmTestId) => void
  beginAcquisition: () => void
  clearResults: () => void
  clearMessages: () => void
}

export const useParamEstStore = create<ParamEstState>((set, get) => ({
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
  control: { ...DEFAULT_CONTROL },

  applyEvent: (e) => {
    if (e.type === 'pe_status') {
      set({
        connected: e.connected,
        port: e.port,
        baudRate: e.baudRate,
        ...(e.connected ? {} : { acquiring: false })
      })
    } else if (e.type === 'pe_progress') {
      set({ frames: e.frames, blocks: e.blocks, bytes: e.bytes, acquiring: true })
    } else if (e.type === 'pe_waveform') {
      set({ waveform: { a: e.a, b: e.b } })
    } else if (e.type === 'pe_result') {
      const prev = get().result
      const base: ParamEstResult = {
        Rs: prev?.Rs ?? NaN,
        Ld: prev?.Ld ?? NaN,
        Lq: prev?.Lq ?? NaN,
        Ke: prev?.Ke ?? NaN,
        J: prev?.J ?? NaN,
        B: prev?.B ?? NaN
      }
      set({
        result: { ...base, ...e.result },
        quality: e.quality,
        acquiring: false,
        dataError: null,
        errorMessage: null
      })
    } else if (e.type === 'pe_data_error') {
      set({
        result: null,
        quality: e.quality ?? null,
        acquiring: false,
        dataError: e.message
      })
    } else if (e.type === 'pe_error') {
      set({ errorMessage: e.message, acquiring: false })
    }
  },

  setControl: (patch) => set({ control: { ...get().control, ...patch } }),
  setConfigValue: (name, value) => set({ config: { ...get().config, [name]: value } }),
  setTest: (test) => set({ control: { ...get().control, test } }),

  beginAcquisition: () =>
    set({
      acquiring: true,
      frames: 0,
      blocks: 0,
      bytes: 0,
      waveform: null,
      dataError: null,
      errorMessage: null
    }),

  clearResults: () => set({ result: null, quality: null, waveform: null }),

  clearMessages: () => set({ dataError: null, errorMessage: null })
}))
