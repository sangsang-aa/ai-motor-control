// 前端静态配置 — 迁移自原 config/motor_config.yaml(敏感 LLM 配置在 .env.local,由服务端代理读取)

/** 默认波特率(当前控制板的 Modbus RTU 配置,8N1)。 */
export const DEFAULT_BAUD = 781250

/**
 * F280025C 固件提供 0x2000..0x20C7 波形缓冲和 0x2200/0x2201 帧状态。
 */
export const WAVE_POLLING_ENABLED = true

/** 本地串口桥地址(Windows 端 serial_bridge.py,桥接模式可同时查看通讯日志) */
export const BRIDGE_URL = 'ws://127.0.0.1:8765'

/** 转速上限(安全约束,超限拒绝) */
export const RPM_LIMIT = 6000

/** 电流告警阈值 (A) */
export const CURRENT_ALARM_THRESHOLD = 10.0

/** 指令确认超时(ms) — 与 Electron 版一致 */
export const COMMAND_CONFIRM_TIMEOUT = 30000

// ── PMSM 参数辨识(独立模块:通讯独立,不复用 Modbus)──────────────
/** 与下位机约定的 SCI 波特率(由上位机设定,下位机跟随) */
export const PARAM_EST_BAUD = 12_000_000

/** 空闲超时(ms):连续该时长无数据 = 下位机已停止发送 = 采集完成 */
export const IDLE_TIMEOUT_MS = 300

/** MCB host-target 协议:每帧 3 个 uint32 / 12 字节,每块 600 帧 */
export const FRAME_WORDS = 3
export const FRAME_BYTES = 12
export const BLOCK_FRAMES = 600
/** 块首标记 'SSSS' = 0x53535353 */
export const HEAD_MARKER = 0x53535353
/** 块尾标记 'EEEE' = 0x45454545 */
export const TAIL_MARKER = 0x45454545
/** 控制字命令号 */
export const CMD_CONTROL = 22

/** 上位机数据帧间隔(下位机每帧一次 = 控制周期);每通道实际采样间隔 = 帧间隔 × 通道数 */
export const FRAME_INTERVAL_S = 1 / 20000

/** 配置器参数顺序,命令号 = 下标 + 1(1..21) */
export const CONFIG_PARAMS = [
  'P', 'NRated', 'IRated', 'ImaxInverter', 'RBoard', 'ISenseGain', 'VSenseGain', 'Ts',
  'FreqMax', 'FreqMin', 'FreqStepSweep', 'FreqStepEst', 'FreqNum',
  'KeTime', 'KeSpeed', 'KpKiInputEnable', 'Kp', 'Ki', 'IqRefFoc', 'JSpeedLow', 'CurrMeasDelay'
] as const

export type ConfigParamName = (typeof CONFIG_PARAMS)[number]

/** 算法输入原始变量(下位机按此顺序逐帧轮发) */
export type AlgoVarKey = 'Vd' | 'Vq' | 'Id' | 'Iq' | 'Speed'

export interface AlgoChannelDef {
  key: AlgoVarKey
  label: string
  unit: string
}

export const ALGO_CHANNELS: AlgoChannelDef[] = [
  { key: 'Vd', label: 'Vd d轴电压', unit: 'V' },
  { key: 'Vq', label: 'Vq q轴电压', unit: 'V' },
  { key: 'Id', label: 'Id d轴电流', unit: 'A' },
  { key: 'Iq', label: 'Iq q轴电流', unit: 'A' },
  { key: 'Speed', label: '转速', unit: 'rpm' }
]

/** 参数中文/用途说明(展示用) */
export const CONFIG_PARAM_LABEL: Record<ConfigParamName, string> = {
  P: '极对数', NRated: '额定转速', IRated: '额定电流', ImaxInverter: '逆变器最大电流',
  RBoard: '板级电阻', ISenseGain: '电流采样增益', VSenseGain: '电压采样增益', Ts: '采样时间',
  FreqMax: '扫频上限', FreqMin: '扫频下限', FreqStepSweep: '扫频步长', FreqStepEst: '估计频步长',
  FreqNum: '频点数', KeTime: 'Ke 测试时长', KeSpeed: 'Ke 测试转速', KpKiInputEnable: 'Kp/Ki 使能',
  Kp: '速度环 Kp', Ki: '速度环 Ki', IqRefFoc: 'FOC Iq 参考', JSpeedLow: 'J 低速阈值',
  CurrMeasDelay: '电流测量延迟'
}
