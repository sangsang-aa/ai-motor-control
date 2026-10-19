/**
 * 数据可用性判定(纯函数) —— 完整性 + 有效性。
 * 采集(空闲超时)结束后、进入辨识之前调用。
 */

import type { DataQualityReport } from '../types'

export interface QualitySample {
  a: number
  b: number
}

export interface QualityOptions {
  /** 完整性:至少需要的完整数据块数(块尾 'EEEE' 计数) */
  minBlocks?: number
  /** 有效性:允许的最大绝对值(超此视为饱和) */
  maxAbs?: number
  /** 有效性:判定"非全零"的阈值 */
  zeroEps?: number
}

const DEFAULTS: Required<QualityOptions> = {
  minBlocks: 1,
  maxAbs: 1e9,
  zeroEps: 1e-9
}

export function assessQuality(
  samples: QualitySample[],
  frames: number,
  blocks: number,
  options: QualityOptions = {}
): DataQualityReport {
  const opt = { ...DEFAULTS, ...options }
  const problems: string[] = []

  // ── 完整性 ──────────────────────────────────────────────────────
  let complete = true
  if (frames <= 0 || samples.length === 0) {
    complete = false
    problems.push('未收到任何数据帧')
  }
  if (blocks < opt.minBlocks) {
    complete = false
    problems.push(`完整数据块不足(需 ≥${opt.minBlocks},实得 ${blocks})`)
  }
  if (samples.some((s) => !Number.isFinite(s.a) || !Number.isFinite(s.b))) {
    complete = false
    problems.push('存在 NaN/Inf 数据')
  }

  // ── 有效性 ──────────────────────────────────────────────────────
  let valid = true
  let amplitude = 0
  for (const s of samples) {
    const m = Math.max(Math.abs(s.a), Math.abs(s.b))
    if (m > amplitude) amplitude = m
  }
  if (amplitude <= opt.zeroEps) {
    valid = false
    problems.push('数据全为零(可能未通电 / 未接电机)')
  }
  if (amplitude >= opt.maxAbs) {
    valid = false
    problems.push('数据饱和(超量程)')
  }

  const ok = complete && valid
  return {
    ok,
    complete,
    valid,
    frames,
    blocks,
    reason: problems.length > 0 ? problems.join('；') : undefined
  }
}
