// 电机状态 — 从 Electron 版原样迁移(window.api 依赖已去除)

import { create } from 'zustand'
import type { MotorStatus, BackendEvent } from '../types'
import { useScopeStore } from './scopeStore'

interface MotorState {
  status: MotorStatus
  rpmHistory: number[]
  currentHistory: number[]
  connected: boolean
  disconnectMessage: boolean
  toolCallVersion: number

  applyEvent: (event: BackendEvent) => void
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

  applyEvent: (event) => {
    if (event.type === 'serial_status') {
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
