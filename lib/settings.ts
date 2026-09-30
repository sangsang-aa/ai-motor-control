// 前端设置 — localStorage 持久化(language / AI 供应商与 API 配置)
// AI 配置随 /api/llm 请求体传递,route 优先使用请求配置,否则回退 .env.local
// useSettingsStore 提供响应式订阅(设置变更即时反映到 UI,如 Topbar 模型名)。

import { create } from 'zustand'

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

export interface ProviderPreset {
  name: string
  baseUrl: string
  models: string[]
  defaultModel: string
}

/** 预设 AI 供应商(模型名为各家官方文档当前清单,可在此维护) */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: '阿里云百炼 (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen3.8-max', 'qwen3.7-plus', 'qwen3.8-flash', 'qwen3-vl-plus'],
    defaultModel: 'qwen-plus'
  },
  { name: '阿里云百炼 (专属部署)', baseUrl: '', models: ['qwen3.7-plus'], defaultModel: 'qwen3.7-plus' },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    defaultModel: 'gpt-5.6-terra'
  },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-v4-pro', 'deepseek-v4-flash'], defaultModel: 'deepseek-v4-pro' },
  {
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2.7-code', 'moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
    defaultModel: 'kimi-k2.6'
  },
  {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.7', 'glm-4.7-flash', 'glm-4.6', 'glm-4.5-air'],
    defaultModel: 'glm-4.7'
  },
  { name: '自定义', baseUrl: '', models: [], defaultModel: '' }
]

export function getProviderPreset(name: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.name === name)
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  provider: '阿里云百炼 (专属部署)',
  baseUrl: '',
  apiKey: '',
  model: 'qwen3.7-plus'
}

// 响应式设置源(组件订阅;save/load 会写这里)
interface SettingsState {
  settings: Settings
  setSettings: (s: Settings) => void
}
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings })
}))

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const settings =
      raw !== null
        ? loadFrom(JSON.parse(raw) as Partial<Settings>)
        : { ...DEFAULT_SETTINGS }
    useSettingsStore.getState().setSettings(settings)
    return settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function loadFrom(parsed: Partial<Settings>): Settings {
  return {
    language: parsed.language === 'en' ? 'en' : 'zh',
    provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
    baseUrl: parsed.baseUrl ?? '',
    apiKey: parsed.apiKey ?? '',
    model: parsed.model ?? DEFAULT_SETTINGS.model
  }
}

export function saveSettings(patch: SettingsPatch): Settings {
  const next = loadFrom({ ...loadSettings(), ...patch })
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* localStorage 不可用时静默 */
  }
  useSettingsStore.getState().setSettings(next)
  return next
}
