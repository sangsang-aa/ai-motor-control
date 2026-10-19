import { describe, it, expect } from 'vitest'
import { demuxAlgoChannels } from '@/lib/analysis/demux'
import { ALGO_CHANNELS } from '@/lib/config'

describe('原始数据按帧解复用', () => {
  it('逐帧轮流拆成各变量序列', () => {
    const n = ALGO_CHANNELS.length
    const samples = Array.from({ length: n * 3 }, (_, i) => ({ a: i, b: 0 }))
    const s = demuxAlgoChannels(samples)
    expect(s.Vd).toEqual([0, n, 2 * n])
    expect(s.Vq).toEqual([1, n + 1, 2 * n + 1])
    expect(s.Id).toEqual([2, n + 2, 2 * n + 2])
    expect(s.Iq).toEqual([3, n + 3, 2 * n + 3])
    expect(s.Speed).toEqual([4, n + 4, 2 * n + 4])
  })

  it('不足一轮也能拆分', () => {
    const s = demuxAlgoChannels([{ a: 10, b: 0 }, { a: 20, b: 0 }])
    expect(s.Vd).toEqual([10])
    expect(s.Vq).toEqual([20])
    expect(s.Id).toEqual([])
  })
})
