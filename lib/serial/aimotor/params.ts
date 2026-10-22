// AI-Motor v1 允许参数表 — 与上位机 parameters.json / 固件 host_parameters.inc 对齐。
// 参数 ID 不是内存地址;写入前必须做范围/类型/安全锁校验。

export interface ParamDef {
  id: number
  key: string
  label: string
  unit: string
  min: number
  max: number
  default: number
  live: boolean
  group: string
  modes: number[]
  integer: boolean
  max_parameter_id?: number
}

export type ParamValidation =
  | { ok: true; value: number }
  | { ok: false; reason: string }

export const AIMOTOR_PARAMS: ParamDef[] = [
  { id: 1, key: 'command_rpm', label: '目标转速', unit: 'rpm', min: -10000, max: 10000, default: 1500, live: true, group: '启动与速度', modes: [6, 8], integer: false },
  { id: 2, key: 'startup_iq_a', label: '启动 Iq 幅值', unit: 'A', min: 0.01, max: 5, default: 0.8, live: false, group: '启动与速度', modes: [6, 8], integer: false },
  { id: 5, key: 'handoff_rpm', label: '接管转速', unit: 'rpm', min: 100, max: 5000, default: 800, live: false, group: '启动与速度', modes: [6, 8], integer: false },
  { id: 6, key: 'if_max_rpm', label: '强拖速度上限', unit: 'rpm', min: 100, max: 5000, default: 1000, live: false, group: '启动与速度', modes: [6, 8], integer: false },
  { id: 7, key: 'if_slew_rpm_per_s', label: '强拖加速度', unit: 'rpm/s', min: 1, max: 5000, default: 200, live: false, group: '启动与速度', modes: [6, 8], integer: false },
  { id: 8, key: 'speed.slew_rpm_per_s', label: '闭环加速度', unit: 'rpm/s', min: 1, max: 30000, default: 4000, live: true, group: '速度环', modes: [6, 8], integer: false },
  { id: 9, key: 'speed.decel_rpm_per_s', label: '闭环减速度', unit: 'rpm/s', min: 1, max: 30000, default: 10000, live: true, group: '速度环', modes: [6, 8], integer: false },
  { id: 10, key: 'current_slew_a_per_s', label: '开环启动 Iq 斜率（0=直接）', unit: 'A/s', min: 0, max: 1000, default: 1, live: false, group: '启动与速度', modes: [6, 8], integer: false },
  { id: 11, key: 'speed.kp', label: '速度 Kp', unit: 'A/rpm', min: 0.000001, max: 1, default: 0.004, live: true, group: '速度环', modes: [6, 8], integer: false },
  { id: 12, key: 'speed.ki', label: '速度 Ki', unit: 'A/(rpm·s)', min: 0.000001, max: 10, default: 0.04, live: true, group: '速度环', modes: [6, 8], integer: false },
  { id: 24, key: 'speed.iq_range_max_a', label: '闭环 Iq 范围上限', unit: 'A', min: 0.01, max: 50, default: 3, live: true, group: '速度环', modes: [6, 8], integer: false },
  { id: 13, key: 'speed.iq_limit_a', label: '闭环最大 Iq（在线）', unit: 'A', min: 0.01, max: 50, default: 3, live: true, group: '速度环', modes: [6, 8], integer: false, max_parameter_id: 24 },
  { id: 14, key: 'speed.speed_filter_hz', label: '速度滤波', unit: 'Hz', min: 1, max: 200, default: 50, live: true, group: '速度环', modes: [6, 8], integer: false },
  { id: 15, key: 'bemf.min_emf_v', label: '反电势有效门槛', unit: 'V', min: 0.001, max: 5, default: 0.2, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 16, key: 'blend_time_ms', label: '角度过渡时间', unit: 'ms', min: 1, max: 1000, default: 50, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 17, key: 'handoff_stable_ms', label: '接管稳定时间', unit: 'ms', min: 1, max: 1000, default: 10, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 18, key: 'handoff_speed_tolerance_rpm', label: '接管速度差容许值', unit: 'rpm', min: 1, max: 1000, default: 80, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 19, key: 'stop_settle_ms', label: '停车等待', unit: 'ms', min: 1, max: 10000, default: 200, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 20, key: 'stop_quiet_ms', label: '停车安静时间', unit: 'ms', min: 10, max: 10000, default: 100, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 21, key: 'stop_emf_v', label: '停车电势门槛', unit: 'V', min: 0.001, max: 5, default: 0.1, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 22, key: 'stop_current_a', label: '停车电流门槛', unit: 'A', min: 0.01, max: 5, default: 0.25, live: false, group: '交接与停车', modes: [6, 8], integer: false },
  { id: 3, key: 'alignment_id_a', label: 'Id 对齐电流', unit: 'A', min: 0.01, max: 5, default: 2, live: false, group: '对齐', modes: [8], integer: false },
  { id: 4, key: 'alignment_time_s', label: 'Id 对齐时间', unit: 's', min: 0.001, max: 60, default: 2, live: false, group: '对齐', modes: [8], integer: false },
  { id: 23, key: 'if_enable', label: 'I/f 启动（0/1）', unit: '', min: 0, max: 1, default: 1, live: false, group: '启动与速度', modes: [6], integer: true },
  { id: 40, key: 'bus_voltage_v', label: '辨识母线电压', unit: 'V', min: 1, max: 200, default: 24, live: false, group: '辨识', modes: [7], integer: false },
  { id: 41, key: 'pole_pairs', label: '极对数', unit: '', min: 1, max: 50, default: 5, live: false, group: '辨识', modes: [7], integer: true },
  { id: 42, key: 'max_test_current_a', label: '最大测试相电流峰值', unit: 'A', min: 0.1, max: 20, default: 5, live: false, group: '辨识', modes: [7], integer: false },
  { id: 50, key: 'phf_voltage_v', label: 'HFI 注入峰值', unit: 'V', min: 0.01, max: 5, default: 0.8, live: false, group: '全局', modes: [0], integer: false },
  { id: 51, key: 'select', label: '参数组（0=旧 / 1=最新）', unit: '', min: 0, max: 1, default: 1, live: false, group: '全局', modes: [0], integer: true },
  { id: 52, key: 'auto_apply_ident', label: '成功辨识后自动应用（0/1）', unit: '', min: 0, max: 1, default: 1, live: false, group: '全局', modes: [0], integer: true }
]

const BY_ID = new Map(AIMOTOR_PARAMS.map((p) => [p.id, p]))

export function getParam(id: number): ParamDef | undefined {
  return BY_ID.get(id)
}

export function paramsForMode(mode: number): ParamDef[] {
  return AIMOTOR_PARAMS.filter((p) => p.modes.includes(mode))
}

export function globalParams(): ParamDef[] {
  return AIMOTOR_PARAMS.filter((p) => p.modes.includes(0))
}

/** 安全锁:AI/自动流程不得修改这些参数(由固件与应用双层校验)。 */
export const AI_LOCKED_PARAM_IDS: ReadonlySet<number> = new Set([6, 13, 24, 42, 51, 52])

export function isAiLocked(id: number): boolean {
  return AI_LOCKED_PARAM_IDS.has(id)
}

export function validateParamValue(
  def: ParamDef,
  value: number,
  lookup?: (id: number) => number | undefined
): ParamValidation {
  if (!Number.isFinite(value)) return { ok: false, reason: `${def.label} 必须是有限数` }
  if (def.integer && !Number.isInteger(value)) return { ok: false, reason: `${def.label} 必须是整数` }
  const max = def.max_parameter_id !== undefined
    ? lookup?.(def.max_parameter_id) ?? def.max
    : def.max
  if (value < def.min || value > max) {
    return { ok: false, reason: `${def.label} 超出范围 ${def.min}..${max}` }
  }
  return { ok: true, value }
}

export const COMMAND_RPM_SAFETY_LIMIT = 6000

export function clampCommandRpm(rpm: number, limit = COMMAND_RPM_SAFETY_LIMIT): number {
  if (!Number.isFinite(rpm)) return 0
  return Math.max(-limit, Math.min(limit, rpm))
}
