import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { estimateLFrom } from '@/lib/analysis/paramEstimation'

const DIR = process.env.SAMPLE_CMP_DIR || '/mnt/d/pe_work/cmp_out'
const have = existsSync(join(DIR, 'sig_ld.csv')) && existsSync(join(DIR, 'sig_lq.csv'))

function readSeries(file: string): { ts: number; v: number[]; i: number[] } {
  const lines = readFileSync(join(DIR, file), 'utf8').trim().split('\n')
  const v: number[] = []
  const i: number[] = []
  let t0 = 0
  let t1 = 0
  lines.forEach((ln, idx) => {
    const p = ln.split(',')
    if (idx === 0) t0 = Number(p[0])
    if (idx === 1) t1 = Number(p[0])
    v.push(Number(p[1]))
    i.push(Number(p[2]))
  })
  return { ts: t1 - t0, v, i }
}

function readResults(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const ln of readFileSync(join(DIR, 'sample_results.txt'), 'utf8').trim().split('\n')) {
    const [k, val] = ln.split('=')
    out[k.trim()] = Number(val)
  }
  return out
}

describe.skipIf(!have)('样例估计器 vs 我的算法(同一条 CSV 输入)', () => {
  it('Ld 对比', () => {
    const r = readResults()
    const { ts, v, i } = readSeries('sig_ld.csv')
    const mine = estimateLFrom(r.R, v, i, ts)
    const dSample = ((r.Ld_sample - r.Ld_true) / r.Ld_true) * 100
    const dMine = ((mine - r.Ld_true) / r.Ld_true) * 100
    console.log(
      `Ld  真值=${r.Ld_true.toExponential(6)}  样例=${r.Ld_sample.toExponential(6)}(${dSample.toFixed(2)}%)  我=${mine.toExponential(6)}(${dMine.toFixed(2)}%)`
    )
    expect(Math.abs(mine - r.Ld_true) / r.Ld_true).toBeLessThan(0.01)
    expect(Math.abs(mine - r.Ld_sample) / r.Ld_sample).toBeLessThan(0.05)
  })

  it('Lq 对比', () => {
    const r = readResults()
    const { ts, v, i } = readSeries('sig_lq.csv')
    const mine = estimateLFrom(r.R, v, i, ts)
    const dSample = ((r.Lq_sample - r.Lq_true) / r.Lq_true) * 100
    const dMine = ((mine - r.Lq_true) / r.Lq_true) * 100
    console.log(
      `Lq  真值=${r.Lq_true.toExponential(6)}  样例=${r.Lq_sample.toExponential(6)}(${dSample.toFixed(2)}%)  我=${mine.toExponential(6)}(${dMine.toFixed(2)}%)`
    )
    expect(Math.abs(mine - r.Lq_true) / r.Lq_true).toBeLessThan(0.01)
    expect(Math.abs(mine - r.Lq_sample) / r.Lq_sample).toBeLessThan(0.05)
  })
})
