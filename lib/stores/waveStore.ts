// 波形批次状态 — 订阅 backendBus.wave_frame,存最新一批 100 点电流波形

import { create } from 'zustand'
import type { WaveFrame } from '../types'

interface WaveState {
  batch: number
  samples: number[]
  hasData: boolean
  apply: (wf: WaveFrame) => void
  clear: () => void
}

export const useWaveStore = create<WaveState>((set) => ({
  batch: 0,
  samples: [],
  hasData: false,
  apply: (wf) => set({ batch: wf.batch, samples: wf.samples, hasData: true }),
  clear: () => set({ batch: 0, samples: [], hasData: false })
}))
