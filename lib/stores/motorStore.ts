// 电机状态 — 从 Electron 版原样迁移(window.api 依赖已去除)

import { create } from 'zustand'
import type { AiMotorEvent, BackendEvent, MotorStatus } from '../types'
import type { ConfigRecord, Model } from '../serial/aimotor/protocol'
import { useScopeStore } from './scopeStore'

interface MotorState {
  status: MotorStatus
  rpmHistory: number[]
  currentHistory: number[]
  connected: boolean
  disconnectMessage: boolean
  toolCallVersion: number

  mode: number
  stage: number
  flags: number
  errorCode: number
  reference: number
  model: Model | null
  config: ConfigRecord[]

  applyEvent: (event: BackendEvent | AiMotorEvent) => void
  updateStatus: (status: MotorStatus) => void
  notifyToolCall: () => void
}

const MAX_HISTORY = 6000

export const useMotorStore = create<MotorState>((set, get) => ({
  status: {
    connected: false,
    port: '',
    baudRate: 0,
    rpm: 0,
    currentIa: 0,
    alarmInfo: ''
  },
  rpmHistory: [],
  currentHistory: [],
  connected: false,
  disconnectMessage: false,
  toolCallVersion: 0,
  mode: 0,
  stage: 0,
  flags: 0,
  errorCode: 0,
  reference: 0,
  model: null,
  config: [],

  applyEvent: (event) => {
    if (event.type === 'ai_status') {
      const disconnected = !event.connected
      const state = get()
      if (disconnected) useScopeStore.getState().resetBuffers()
      set({
        connected: event.connected,
        disconnectMessage: event.connected ? false : state.disconnectMessage,
        ...(disconnected ? { rpmHistory: [], currentHistory: [] } : {}),
        status: {
          ...state.status,
          connected: event.connected,
          port: event.port,
          baudRate: event.baudRate,
          ...(event.connected ? { alarmInfo: '' } : {}),
          ...(disconnected ? { rpm: 0, currentIa: 0 } : {})
        }
      })
    } else if (event.type === 'ai_sample') {
      const s = event.sample
      const state = get()
      set({
        mode: s.mode,
        stage: s.stage,
        flags: s.flags,
        errorCode: s.error,
        reference: s.reference,
        rpmHistory: [...state.rpmHistory, s.speed].slice(-MAX_HISTORY),
        currentHistory: [...state.currentHistory, s.iu].slice(-MAX_HISTORY),
        status: { ...state.status, rpm: s.speed, currentIa: s.iu }
      })
    } else if (event.type === 'ai_model') {
      set({ model: event.model })
    } else if (event.type === 'ai_config') {
      set({ config: event.records })
    } else if (event.type === 'ai_error') {
      set({
        disconnectMessage: true,
        status: { ...get().status, alarmInfo: event.message }
      })
    } else if (event.type === 'ai_closed') {
      set({ connected: false, status: { ...get().status, connected: false } })
    } else if (event.type === 'ai_executed' || event.type === 'ai_ack') {
      /* 命令确认由 ChatApp / 调用方处理 */
    } else if (event.type === 'serial_status') {
      const disconnected = !event.connected
      const state = get()
      if (disconnected) useScopeStore.getState().resetBuffers()
      set({
        connected: event.connected,
        disconnectMessage: event.connected ? false : state.disconnectMessage,
        ...(disconnected ? { rpmHistory: [], currentHistory: [] } : {}),
        status: {
          ...state.status,
          connected: event.connected,
          port: event.port,
          ...(event.connected ? { alarmInfo: '' } : {}),
          ...(disconnected ? { rpm: 0, currentIa: 0 } : {})
        }
      })
    } else if (event.type === 'wave_frame') {
      useScopeStore.getState().enqueueWaveFrame(event.samples, get().status.rpm, event.batch)
    } else if (event.type === 'telemetry') {
      const state = get()
      const newRpms =
        event.seriesRpm && event.seriesRpm.length > 0 ? event.seriesRpm : [event.rpm]
      const newIas =
        event.seriesIa && event.seriesIa.length > 0 ? event.seriesIa : [event.current]
      const rpmHistory = [...state.rpmHistory, ...newRpms].slice(-MAX_HISTORY)
      const currentHistory = [...state.currentHistory, ...newIas].slice(-MAX_HISTORY)
      set({
        rpmHistory,
        currentHistory,
        status: {
          ...state.status,
          rpm: event.rpm,
          currentIa: event.current
        }
      })
    } else if (event.type === 'error') {
      set({
        disconnectMessage: true,
        status: { ...get().status, alarmInfo: event.message }
      })
    }
  },

  updateStatus: (status) => set({ status }),
  notifyToolCall: () => set((s) => ({ toolCallVersion: s.toolCallVersion + 1 }))
}))
