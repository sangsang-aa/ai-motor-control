// 前端设置 — localStorage 持久化(language / AI 供应商与 API 配置)
// AI 配置随 /api/llm 请求体传递,route 优先使用请求配置,否则回退 .env.local

export type Language = 'zh' | 'en'

export interface Settings {
  language: Language
  provider: string
  baseUrl: string
  apiKey: string
  model: string
}

export type SettingsPatch = Partial<Settings>

const LS_KEY = 'mototune.settings'

/** 预设 AI 供应商(与 .env.example 里的说明映射) */
export const PROVIDER_PRESETS: { name: string; baseUrl: string; model: string }[] = [
  { name: '阿里云百炼 (DashScope)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '阿里云百炼 (专属部署)', baseUrl: '', model: 'qwen3.7-plus' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '自定义', baseUrl: '', model: '' }
]

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  provider: '阿里云百炼 (专属部署)',
  baseUrl: '',
  apiKey: '',
  model: 'qwen3.7-plus'
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      language: parsed.language === 'en' ? 'en' : 'zh',
      provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
      baseUrl: parsed.baseUrl ?? '',
      apiKey: parsed.apiKey ?? '',
      model: parsed.model ?? DEFAULT_SETTINGS.model
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(patch: SettingsPatch): Settings {
  const next = { ...loadSettings(), ...patch }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* localStorage 不可用时静默 */
  }
  return next
}
