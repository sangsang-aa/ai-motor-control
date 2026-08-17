// 顶栏 — 从 Electron 版迁移;串口连接改为 Web Serial(系统对话框选设备,端口输入框移除)

'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { connect, disconnect, getPortName } from '@/lib/serial/motorController'
import { DEFAULT_BAUD } from '@/lib/config'

export const Topbar: React.FC = () => {
  const { connected, status } = useMotorStore()
  const [baud, setBaud] = React.useState(String(DEFAULT_BAUD))

  const handleToggle = async () => {
    const b = parseInt(baud)
    if (isNaN(b) || b <= 0) {
      alert('请输入有效的波特率数值')
      return
    }
    if (connected) {
      await disconnect()
    } else {
      const r = await connect(b)
      if (!r.ok && r.error) alert(r.error)
    }
  }

  return (
    <header className="topbar">
      <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.12em', background: 'linear-gradient(135deg,#00a8ff,#4dc9ff,#00a8ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontStyle: 'italic' }}>MOTOTUNE</span>
      <div className="flex items-center gap-2 ml-6 text-xs">
        <span className={`topbar-indicator ${connected ? 'on' : 'off'}`} />
        <span className="text-fg-muted" style={{ minWidth: 48 }}>{connected ? '已连接' : '未连接'}</span>
        {connected && <span className="text-fg-subtle" style={{ fontSize: 10 }}>{getPortName()}</span>}
        <span className="text-fg-subtle" style={{ fontSize: 10, minWidth: 42 }}>波特率</span>
        <input value={baud} onChange={(e) => setBaud(e.target.value)} disabled={connected}
          className="input-base text-xs py-1 px-2" style={{ width: 100, minHeight: 26, opacity: connected ? 0.5 : 1 }} placeholder="150000" />
        <button onClick={handleToggle}
          className="px-3 py-1 rounded-lg text-xs font-medium border transition-all"
          style={{ background: connected ? 'rgba(255,59,48,0.15)' : 'rgba(0,168,255,0.1)', color: connected ? '#ff3b30' : '#00a8ff', borderColor: connected ? 'rgba(255,59,48,0.25)' : 'rgba(0,168,255,0.2)' }}>
          {connected ? '断开' : '连接串口'}
        </button>
      </div>
      <div className="flex items-center gap-5 ml-auto">
        <div className="topbar-stat"><span>转速</span><span className="v">{status.rpm.toFixed(0)}</span><span className="u">RPM</span></div>
        <div className="topbar-stat"><span>电流</span><span className="v">{status.currentIa.toFixed(2)}</span><span className="u">A</span></div>
        {connected && <span className="text-[10px] text-fg-subtle">{status.baudRate} baud</span>}
      </div>
    </header>
  )
}
