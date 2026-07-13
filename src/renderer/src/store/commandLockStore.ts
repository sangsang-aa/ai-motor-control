import { create } from 'zustand'
import type { LockStatus } from '../../../shared/types'

interface LockState {
  status: LockStatus
  toolCallId: string
  lockedAt: number
  lock: (toolCallId: string) => void
  setExecuting: () => void
  unlock: () => void
}

export const useCommandLock = create<LockState>((set) => ({
  status: 'idle', toolCallId: '', lockedAt: 0,
  lock: (toolCallId) => set({ status: 'pending', toolCallId, lockedAt: Date.now() }),
  setExecuting: () => set(s => s.status === 'pending' ? { status: 'executing' } : s),
  unlock: () => set({ status: 'idle', toolCallId: '', lockedAt: 0 })
}))
