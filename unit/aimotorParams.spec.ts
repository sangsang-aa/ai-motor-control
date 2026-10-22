import { describe, it, expect } from 'vitest'
import {
  AIMOTOR_PARAMS,
  AI_LOCKED_PARAM_IDS,
  COMMAND_RPM_SAFETY_LIMIT,
  getParam,
  paramsForMode,
  globalParams,
  isAiLocked,
  validateParamValue,
  validateAiParam,
  clampCommandRpm
} from '@/lib/serial/aimotor/params'

describe('aimotor 参数表', () => {
  it('ID 唯一且默认值在范围内', () => {
    const ids = AIMOTOR_PARAMS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of AIMOTOR_PARAMS) {
      expect(p.min).toBeLessThanOrEqual(p.default)
      expect(p.default).toBeLessThanOrEqual(p.max)
      expect(p.modes.length).toBeGreaterThan(0)
      expect(p.label.length).toBeGreaterThan(0)
    }
  })

  it('按 ID / mode 查询', () => {
    expect(getParam(1)?.key).toBe('command_rpm')
    expect(getParam(999)).toBeUndefined()
    expect(paramsForMode(7).map((p) => p.id)).toEqual(expect.arrayContaining([40, 41, 42]))
    expect(paramsForMode(7).map((p) => p.id)).not.toContain(1)
    expect(paramsForMode(6).map((p) => p.id)).toEqual(expect.arrayContaining([1, 11, 12, 24, 13]))
    expect(globalParams().map((p) => p.id)).toEqual(expect.arrayContaining([50, 51, 52]))
  })

  it('安全锁覆盖强拖/Iq/辨识电流/参数组', () => {
    for (const id of [6, 13, 24, 42, 51, 52]) expect(isAiLocked(id)).toBe(true)
    for (const id of [1, 11, 12, 40]) expect(isAiLocked(id)).toBe(false)
    expect(AI_LOCKED_PARAM_IDS.size).toBe(6)
  })

  it('范围/整数/有限数校验', () => {
    const rpm = getParam(1)!
    expect(validateParamValue(rpm, 1500).ok).toBe(true)
    expect(validateParamValue(rpm, 20000).ok).toBe(false)
    expect(validateParamValue(rpm, Number.NaN).ok).toBe(false)

    const polePairs = getParam(41)!
    expect(validateParamValue(polePairs, 5).ok).toBe(true)
    expect(validateParamValue(polePairs, 5.5).ok).toBe(false)
  })

  it('id13 的上限跟随 id24', () => {
    const iqLimit = getParam(13)!
    const low = validateParamValue(iqLimit, 3, (id) => (id === 24 ? 2.5 : undefined))
    expect(low.ok).toBe(false)
    const high = validateParamValue(iqLimit, 3, (id) => (id === 24 ? 3.5 : undefined))
    expect(high.ok).toBe(true)
  })

  it('转速安全限幅 6000 RPM', () => {
    expect(COMMAND_RPM_SAFETY_LIMIT).toBe(6000)
    expect(clampCommandRpm(9000)).toBe(6000)
    expect(clampCommandRpm(-9000)).toBe(-6000)
    expect(clampCommandRpm(Number.NaN)).toBe(0)
  })

  it('AI 写参数:拒绝锁定/未知,允许普通参数', () => {
    expect(validateAiParam(24, 10).ok).toBe(false)
    expect(validateAiParam(6, 1000).ok).toBe(false)
    expect(validateAiParam(13, 3).ok).toBe(false)
    expect(validateAiParam(42, 5).ok).toBe(false)
    expect(validateAiParam(999, 1).ok).toBe(false)
    expect(validateAiParam(1, 1500).ok).toBe(true)
    expect(validateAiParam(11, 0.004).ok).toBe(true)
    expect(validateAiParam(1, 20000).ok).toBe(false)
  })
})
