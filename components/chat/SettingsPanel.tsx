'use client'

import React, { useState, useEffect } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { loadSettings, saveSettings, PROVIDER_PRESETS, getProviderPreset, type Language } from '@/lib/settings'

export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const [step, setStep] = useState<'provider' | 'api'>('provider')
  const [provider, setProvider] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const s = loadSettings()
    setProvider(s.provider)
    setBaseUrl(s.baseUrl)
    setApiKey(s.apiKey)
    setModel(s.model)
    setSaved(false)
  }, [])

  const models = getProviderPreset(provider)?.models ?? []
  const hasModelList = models.length > 0

  useEffect(() => {
    const list = getProviderPreset(provider)?.models ?? []
    if (list.length > 0 && !list.includes(model)) setModel(list[0])
  }, [provider, model])

  const handleLang = (l: Language) => {
    setLang(l)
    saveSettings({ language: l })
  }

  const pickProvider = (name: string) => {
    const current = loadSettings()
    const preset = getProviderPreset(name)
    setProvider(name)
    if (name === current.provider) {
      setBaseUrl(current.baseUrl)
      setApiKey(current.apiKey)
      setModel(current.model)
    } else {
      setBaseUrl(preset?.baseUrl ?? '')
      setModel(preset?.defaultModel ?? '')
      setApiKey('')
    }
    setStep('api')
  }

  const handleSave = () => {
    const next = saveSettings({ language: lang, provider, baseUrl, apiKey, model })
    setLang(next.language)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
  const box: React.CSSProperties = {
    background: 'var(--cx-surface)', border: '1px solid var(--cx-border-2)', borderRadius: 14,
    padding: '20px 24px', width: 420, maxWidth: '90vw', color: 'var(--cx-text)'
  }
  const label: React.CSSProperties = { fontSize: 12, color: 'var(--cx-muted)', marginBottom: 4, display: 'block' }
  const input: React.CSSProperties = { width: '100%', background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '8px 10px', color: 'var(--cx-text)', fontSize: 13 }

  return (
    <div style={overlay}>
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{t(lang, 'settingsTitle')}</span>
          <button data-testid="settings-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cx-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {step === 'provider' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>{t(lang, 'language')}</label>
              <select value={lang} onChange={(e) => handleLang(e.target.value as Language)} style={input}>
                <option value="zh">简体中文</option>
                <option value="en">English</option>
              </select>
            </div>

            <label style={label}>{t(lang, 'aiProvider')}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.name}
                  data-testid="settings-provider-item"
                  onClick={() => pickProvider(p.name)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '9px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    background: p.name === provider ? 'var(--cx-surface-2)' : 'transparent',
                    border: `1px solid ${p.name === provider ? 'var(--cx-border-2)' : 'var(--cx-border)'}`,
                    color: 'var(--cx-text)'
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--cx-subtle)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.baseUrl || '—'}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <button data-testid="settings-api-back" onClick={() => setStep('provider')} className="cx-btn cx-btn-ghost">
                ← {t(lang, 'aiProvider')}
              </button>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{provider}</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>{t(lang, 'apiBaseUrl')}</label>
              <input data-testid="settings-base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={input} placeholder="https://.../v1" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>{t(lang, 'apiKey')}</label>
              <input data-testid="settings-api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={input} placeholder="sk-..." />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={label}>{t(lang, 'model')}</label>
              {hasModelList ? (
                <select data-testid="settings-model" value={model} onChange={(e) => setModel(e.target.value)} style={input}>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input data-testid="settings-model" value={model} onChange={(e) => setModel(e.target.value)} style={input} placeholder="model-id" />
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="cx-btn cx-btn-ghost">{t(lang, 'close')}</button>
              <button data-testid="settings-save" onClick={handleSave} className="cx-btn cx-btn-primary">{saved ? '✓ ' + t(lang, 'save') : t(lang, 'save')}</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--cx-subtle)', lineHeight: 1.7 }}>
              保存后仅当前供应商配置生效;API Key 保存在本机 localStorage。
            </div>
          </>
        )}
      </div>
    </div>
  )
}
