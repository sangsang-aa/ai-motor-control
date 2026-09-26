// 主区顶部条 — Altior 风格:左侧模型下拉,右侧串口状态 + 波特率 + 连接按钮。
// 转速/电流已迁至示波器"实时数据"区。可测选择器:header.topbar / header.topbar button / header.topbar input。

'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { connect, connectBridge, disconnect, getPortName } from '@/lib/serial/motorController'
import { BRIDGE_URL, DEFAULT_BAUD } from '@/lib/config'
import { useLangStore, t } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/settings'

export const Topbar: React.FC = () => {
  const lang = useLangStore((s) => s.lang)
  const { connected, status } = useMotorStore()
  const [baud, setBaud] = React.useState(String(DEFAULT_BAUD))
  const model = useSettingsStore((s) => s.settings.model || 'qwen-plus')

  const handleToggle = async () => {
    const b = parseInt(baud)
    if (isNaN(b) || b <= 0) { alert('请输入有效的波特率数值'); return }
    if (connected) { await disconnect() }
    else {
      const r = await connect(b)
      if (!r.ok && r.error) alert(r.error)
    }
  }

  // 桥接模式:浏览器经 ws://127.0.0.1:8765 直连本地 serial_bridge.py(独占 COM 并打印通讯日志)。
  // 注意:已连接时重复点击不动作(断开请用右侧主按钮),避免误触切掉会话。
  const handleBridge = async () => {
    if (connected) return
    const r = await connectBridge(BRIDGE_URL)
    if (!r.ok && r.error) alert(`桥接失败: ${r.error}`)
  }

  return (
    <header className="topbar main-topbar">
      <span className="model-pill">{model} <span style={{ fontSize: 10 }}>▾</span></span>

      <div style={{ flex: 1 }} />
      <span className={`conn`}>
        <span className={`dot ${connected ? 'on' : 'off'}`} />
        <span>{connected ? t(lang, 'connected') : t(lang, 'disconnected')}</span>
        {connected && <span style={{ color: 'var(--cx-subtle)', fontSize: 11 }}>{getPortName()}</span>}
      </span>
      <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>{t(lang, 'baud')}</span>
      <input value={baud} onChange={(e) => setBaud(e.target.value)} disabled={connected}
        className="input-base" style={{ width: 92, minHeight: 26, fontSize: 12, padding: '4px 8px', opacity: connected ? 0.5 : 1 }} placeholder="150000" />
      <button onClick={handleBridge} className="cx-btn cx-btn-ghost"
        title={`桥接模式: COM → ${BRIDGE_URL}(serial_bridge.py),同时可在桥接窗口看到通讯帧`}>
        {connected ? t(lang, 'disconnect') : '桥接'}
      </button>
      <button onClick={handleToggle} className={`cx-btn ${connected ? 'cx-btn-danger' : 'cx-btn-primary'}`}>
        {connected ? t(lang, 'disconnect') : t(lang, 'connect')}
      </button>
    </header>
  )
}
