// 电机状态 — AI-Motor v1 遥测/模型/配置;仅经 aiMotorBus 更新。

import { create } from 'zustand'
import type { AiMotorEvent, MotorStatus } from '../types'
import type { ConfigRecord, Model, Sample } from '../serial/aimotor/protocol'
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
  id: number
  iq: number
  model: Model | null
  config: ConfigRecord[]
  lastSample: Sample | null

  applyEvent: (event: AiMotorEvent) => void
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
  id: 0,
  iq: 0,
  model: null,
  config: [],
  lastSample: null,

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
        id: s.id,
        iq: s.iq,
        lastSample: s,
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
    }
  },

  updateStatus: (status) => set({ status }),
  notifyToolCall: () => set((s) => ({ toolCallVersion: s.toolCallVersion + 1 }))
}))
