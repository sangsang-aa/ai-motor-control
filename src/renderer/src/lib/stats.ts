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
  const count = n - start
  for (let i = start; i < n; i++) {
    const v = buf[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { min, max, avg: sum / count, last: buf[n - 1] ?? 0 }
}
