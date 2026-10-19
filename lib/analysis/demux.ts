import { ALGO_CHANNELS, type AlgoVarKey } from '../config'

export type AlgoSeries = Record<AlgoVarKey, number[]>

/** 按帧把原始数据拆成各算法变量的序列(下位机逐帧轮发) */
export function demuxAlgoChannels(samples: { a: number; b: number }[]): AlgoSeries {
  const keys = ALGO_CHANNELS.map((c) => c.key)
  const out = Object.fromEntries(keys.map((k) => [k, [] as number[]])) as AlgoSeries
  for (let i = 0; i < samples.length; i++) {
    out[keys[i % keys.length]].push(samples[i].a)
  }
  return out
}
