import { create } from 'zustand'
import type { MotorStatus, BackendEvent } from '../../../shared/types'

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
      set({
        connected: event.connected,
        disconnectMessage: !event.connected,
        status: { ...get().status, connected: event.connected, port: event.port }
      })
    } else if (event.type === 'telemetry') {
      const state = get()
      const rpmHistory = [...state.rpmHistory, event.rpm].slice(-MAX_HISTORY)
      const currentHistory = [...state.currentHistory, event.current].slice(-MAX_HISTORY)
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
      set({ disconnectMessage: true })
    }
  },

  updateStatus: (status) => set({ status }),
  notifyToolCall: () => set(s => ({ toolCallVersion: s.toolCallVersion + 1 }))
}))
