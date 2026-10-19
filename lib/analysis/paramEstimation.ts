import { ALGO_CHANNELS, FRAME_INTERVAL_S, type AlgoVarKey } from '../config'
import type { ParamEstResult, PmTestId } from '../types'
import { demuxAlgoChannels, type AlgoSeries } from './demux'

export interface EstimationOptions {
  /** 每通道采样间隔(s);缺省 = 帧间隔 × 通道数 */
  ts?: number
  rBoard: number
  rs?: number
  ld?: number
  polePairs?: number
}

/** 每通道采样间隔 = 帧间隔 × 通道数 */
export function perChannelTs(): number {
  return FRAME_INTERVAL_S * ALGO_CHANNELS.length
}

/** 两通道在同一帧内的采样时差(秒)=(slotJ - slotI) × 帧间隔 */
function channelSkewS(iKey: AlgoVarKey, jKey: AlgoVarKey): number {
  const si = ALGO_CHANNELS.findIndex((c) => c.key === iKey)
  const sj = ALGO_CHANNELS.findIndex((c) => c.key === jKey)
  return (sj - si) * FRAME_INTERVAL_S
}

function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN
}

function halfMeans(a: number[]): [number, number] {
  const n = Math.floor(a.length / 2)
  if (n === 0) return [NaN, NaN]
  return [mean(a.slice(0, n)), mean(a.slice(n))]
}

/** 上升过零点的插值时刻(与样例的过零插值一致) */
export function upCrossTimes(v: number[], ts: number): number[] {
  const out: number[] = []
  for (let i = 1; i < v.length; i++) {
    if (v[i - 1] < 0 && v[i] >= 0) {
      const frac = -v[i - 1] / (v[i] - v[i - 1])
      out.push((i - 1 + frac) * ts)
    }
  }
  return out
}

export function estimateFrequency(v: number[], ts: number): number {
  const t = upCrossTimes(v, ts)
  if (t.length < 2 || !(ts > 0)) return NaN
  const period = (t[t.length - 1] - t[0]) / (t.length - 1)
  return period > 0 ? 1 / period : NaN
}

export function estimatePhaseRad(
  voltage: number[],
  current: number[],
  ts: number,
  skewS = 0
): number {
  const tv = upCrossTimes(voltage, ts)
  const ti = upCrossTimes(current, ts)
  if (tv.length === 0 || ti.length === 0) return NaN
  const f = estimateFrequency(current, ts)
  if (!(f > 0)) return NaN
  const p = 2 * Math.PI * f * (ti[0] - tv[0] + skewS)
  return ((p % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
}

export function estimateLFrom(
  resistance: number,
  voltage: number[],
  current: number[],
  ts: number,
  skewS = 0
): number {
  const f = estimateFrequency(current, ts)
  const ph = estimatePhaseRad(voltage, current, ts, skewS)
  if (!(f > 0) || !Number.isFinite(ph)) return NaN
  return (resistance * Math.tan(ph)) / (2 * Math.PI * f)
}

export function estimateForTest(test: PmTestId, s: AlgoSeries, opt: EstimationOptions): Partial<ParamEstResult> {
  const ts = opt.ts ?? perChannelTs()
  if (test === 1) {
    const [v1, v2] = halfMeans(s.Vd)
    const [i1, i2] = halfMeans(s.Id)
    const di = i2 - i1
    return { Rs: Math.abs(di) < 1e-12 ? NaN : (v2 - v1) / di - opt.rBoard }
  }
  if (test === 2) {
    return { Ld: estimateLFrom((opt.rs ?? 0) + opt.rBoard, s.Vd, s.Id, ts, channelSkewS('Vd', 'Id')) }
  }
  if (test === 3) {
    return { Lq: estimateLFrom((opt.rs ?? 0) + opt.rBoard, s.Vq, s.Iq, ts, channelSkewS('Vq', 'Iq')) }
  }
  if (test === 4) {
    const speed = mean(s.Speed)
    const omega = (speed * 2 * Math.PI) / 60
    const P = opt.polePairs ?? 1
    if (!(omega > 0)) return { Ke: NaN, J: NaN, B: NaN }
    const vq = mean(s.Vq)
    const iq = mean(s.Iq)
    const id = mean(s.Id)
    const lambda = (vq - iq * (opt.rs ?? 0) - id * (opt.ld ?? 0) * omega * P) / (omega * P)
    return {
      Ke: (lambda * Math.sqrt(3) * (omega * P)) / (speed * 0.001),
      J: NaN,
      B: (1.5 * P * lambda * iq) / omega
    }
  }
  return {}
}

export interface PriorResults {
  rBoard?: number
  Rs?: number
  Ld?: number
}

/** 由原始帧解复用并按测试辨识;Ld/Lq 依赖先前的 Rs,Ke 依赖 Rs/Ld */
export function estimateWithPrior(
  test: PmTestId,
  samples: { a: number; b: number }[],
  prior: PriorResults
): Partial<ParamEstResult> {
  const series = demuxAlgoChannels(samples)
  return estimateForTest(test, series, { rBoard: prior.rBoard ?? 0, rs: prior.Rs, ld: prior.Ld })
}
