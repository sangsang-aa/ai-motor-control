// 主区顶部条 — Altior 风格:左侧模型下拉,右侧串口状态 + 波特率 + 转速电流。
// 保留可测选择器:header.topbar / header.topbar button / header.topbar input / .topbar-stat。

'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { connect, disconnect, getPortName } from '@/lib/serial/motorController'
import { DEFAULT_BAUD } from '@/lib/config'
import { useLangStore, t } from '@/lib/i18n'
import { loadSettings } from '@/lib/settings'

export const Topbar: React.FC = () => {
  const lang = useLangStore((s) => s.lang)
  const { connected, status } = useMotorStore()
  const [baud, setBaud] = React.useState(String(DEFAULT_BAUD))
  const [modelDisplay] = React.useState(() => loadSettings().model || 'qwen-plus')

  const handleToggle = async () => {
    const b = parseInt(baud)
    if (isNaN(b) || b <= 0) { alert('请输入有效的波特率数值'); return }
    if (connected) { await disconnect() }
    else {
      const r = await connect(b)
      if (!r.ok && r.error) alert(r.error)
    }
  }

  return (
    <header className="topbar main-topbar">
      {/* 左:模型下拉(pill) */}
      <span className="model-pill">{modelDisplay} <span style={{ fontSize: 10 }}>▾</span></span>

      {/* 右:串口状态 + 波特率 + 连接 + 转速/电流 */}
      <div style={{ flex: 1 }} />
      <span className={`conn`}>
        <span className={`dot ${connected ? 'on' : 'off'}`} />
        <span>{connected ? t(lang, 'connected') : t(lang, 'disconnected')}</span>
        {connected && <span style={{ color: '#6b7075', fontSize: 11 }}>{getPortName()}</span>}
      </span>
      <span className="text-tertiary" style={{ fontSize: 11, color: '#6b7075' }}>{t(lang, 'baud')}</span>
      <input value={baud} onChange={(e) => setBaud(e.target.value)} disabled={connected}
        className="input-base" style={{ width: 92, minHeight: 26, background: '#1c1c1c', border: '1px solid #2a2a2a', color: '#e8ecf1', fontSize: 12, padding: '4px 8px', opacity: connected ? 0.5 : 1 }} placeholder="150000" />
      <button onClick={handleToggle}
        className="px-3 py-1 rounded-lg text-xs font-medium border transition-all"
        style={{ background: connected ? 'rgba(255,59,48,0.15)' : 'rgba(43,184,168,0.12)', color: connected ? '#ff3b30' : '#2bb8a8', borderColor: connected ? 'rgba(255,59,48,0.25)' : 'rgba(43,184,168,0.3)' }}>
        {connected ? t(lang, 'disconnect') : t(lang, 'connect')}
      </button>

      <div className="flex items-center gap-5" style={{ marginLeft: 8 }}>
        <div className="topbar-stat"><span>{t(lang, 'rpm')}</span><b>{status.rpm.toFixed(0)}</b><span style={{ color: '#6b7075', fontSize: 10 }}>RPM</span></div>
        <div className="topbar-stat"><span>{t(lang, 'current')}</span><b>{status.currentIa.toFixed(2)}</b><span style={{ color: '#6b7075', fontSize: 10 }}>A</span></div>
      </div>
    </header>
  )
}
