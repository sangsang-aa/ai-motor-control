import { describe, it, expect, beforeEach } from 'vitest'
import { PROVIDER_PRESETS, DEFAULT_SETTINGS, getProviderPreset, saveSettings, loadSettings } from '@/lib/settings'

beforeEach(() => {
  localStorage.clear()
})

describe('settings providers', () => {
  it('每个非自定义供应商 models 非空且 defaultModel 属于 models', () => {
    for (const p of PROVIDER_PRESETS) {
      if (p.name === '自定义') {
        expect(p.models).toEqual([])
        continue
      }
      expect(p.models.length).toBeGreaterThan(0)
      expect(p.models).toContain(p.defaultModel)
    }
  })

  it('getProviderPreset 命中与未命中', () => {
    expect(getProviderPreset('OpenAI')?.models).toContain('gpt-4.1')
    expect(getProviderPreset('OpenAI')?.baseUrl).toBe('https://api.openai.com/v1')
    expect(getProviderPreset('不存在的供应商')).toBeUndefined()
  })

  it('saveSettings → loadSettings 保留 provider/baseUrl/model', () => {
    saveSettings({ provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro' })
    const s = loadSettings()
    expect(s.provider).toBe('DeepSeek')
    expect(s.baseUrl).toBe('https://api.deepseek.com/v1')
    expect(s.model).toBe('deepseek-v4-pro')
  })

  it('存储缺 model 时回退默认', () => {
    localStorage.setItem('mototune.settings', JSON.stringify({ provider: 'DeepSeek' }))
    expect(loadSettings().model).toBe(DEFAULT_SETTINGS.model)
  })
})
