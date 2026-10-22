import { describe, it, expect } from 'vitest'
import { PARAM_GROUP_ORDER, groupParams, paramMode, isSafetyParam } from '@/lib/serial/aimotor/control'
import { AIMOTOR_PARAMS, getParam } from '@/lib/serial/aimotor/params'

describe('control helpers', () => {
  it('分组覆盖全部参数且顺序固定', () => {
    const groups = groupParams()
    expect(groups.map((g) => g.group)).toEqual(expect.arrayContaining(PARAM_GROUP_ORDER))
    const total = groups.reduce((n, g) => n + g.params.length, 0)
    expect(total).toBe(AIMOTOR_PARAMS.length)
  })

  it('paramMode 选择当前模式/全局/首个模式', () => {
    expect(paramMode(getParam(1)!, 8)).toBe(8)
    expect(paramMode(getParam(1)!, 6)).toBe(6)
    expect(paramMode(getParam(1)!, 5)).toBe(6)
    expect(paramMode(getParam(40)!, 7)).toBe(7)
    expect(paramMode(getParam(50)!, 6)).toBe(0)
  })

  it('isSafetyParam 与 AI 锁一致', () => {
    for (const id of [6, 13, 24, 42, 51, 52]) expect(isSafetyParam(id)).toBe(true)
    for (const id of [1, 11, 12, 40]) expect(isSafetyParam(id)).toBe(false)
  })
})
