// 示波器通道统计 — 从 Electron 版 src/renderer/src/lib/stats.ts 原样迁移

export interface ChannelStats {
  min: number
  max: number
  avg: number
  last: number
}

export function computeStats(buf: Float32Array, n: number, filled: number): ChannelStats {
  const start = Math.max(0, n - filled)
  if (start >= n) return { min: 0, max: 0, avg: 0, last: 0 }
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let count = 0
  let last = 0
  for (let i = start; i < n; i++) {
    const v = buf[i]
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
    sum += v
    count += 1
    last = v
  }
  if (count === 0) return { min: 0, max: 0, avg: 0, last: 0 }
  return { min, max, avg: sum / count, last }
}
