'use client'

import React, { useState, useEffect } from 'react'
import { useLangStore, t } from '@/lib/i18n'
import { loadSettings, saveSettings, PROVIDER_PRESETS, DEFAULT_SETTINGS, type Language } from '@/lib/settings'

export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
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

  const onProviderChange = (name: string) => {
    setProvider(name)
    const preset = PROVIDER_PRESETS.find((p) => p.name === name)
    if (preset) {
      if (preset.baseUrl) setBaseUrl(preset.baseUrl)
      if (preset.model) setModel(preset.model)
    }
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cx-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>{t(lang, 'language')}</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as Language)} style={input}>
            <option value="zh">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>{t(lang, 'aiProvider')}</label>
          <select value={provider} onChange={(e) => onProviderChange(e.target.value)} style={input}>
            {PROVIDER_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>{t(lang, 'apiBaseUrl')}</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={input} placeholder="https://.../v1" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>{t(lang, 'apiKey')}</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={input} placeholder="sk-..." />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label}>{t(lang, 'model')}</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} style={input} placeholder="qwen-plus" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="cx-btn cx-btn-ghost">{t(lang, 'close')}</button>
          <button onClick={handleSave} className="cx-btn cx-btn-primary">{saved ? '✓ ' + t(lang, 'save') : t(lang, 'save')}</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--cx-subtle)', lineHeight: 1.7 }}>
          填写后发送给 /api/llm 的请求会优先使用此处配置;留空则回退服务端 .env.local。API Key 保存在本机 localStorage。
        </div>
      </div>
    </div>
  )
}
