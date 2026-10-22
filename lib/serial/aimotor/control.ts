import { AIMOTOR_PARAMS, isAiLocked, type ParamDef } from './params'

export const PARAM_GROUP_ORDER = ['启动与速度', '速度环', '交接与停车', '对齐', '辨识', '全局']

export function groupParams(): { group: string; params: ParamDef[] }[] {
  const groups = new Map<string, ParamDef[]>()
  for (const p of AIMOTOR_PARAMS) {
    const list = groups.get(p.group) ?? []
    list.push(p)
    groups.set(p.group, list)
  }
  const ordered = PARAM_GROUP_ORDER
    .filter((g) => groups.has(g))
    .map((g) => ({ group: g, params: groups.get(g)! }))
  for (const [g, params] of groups) {
    if (!PARAM_GROUP_ORDER.includes(g)) ordered.push({ group: g, params })
  }
  return ordered
}

export function paramMode(def: ParamDef, activeMode: number): number {
  if (def.modes.includes(activeMode)) return activeMode
  if (def.modes.includes(0)) return 0
  return def.modes[0] ?? 0
}

export function isSafetyParam(id: number): boolean {
  return isAiLocked(id)
}
