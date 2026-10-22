'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useMotorStore } from '@/lib/stores/motorStore'
import {
  connect,
  disconnect,
  getPortName,
  isDemo,
  isWebSerialSupported,
  sendCommand,
  startDemo,
  stopDemo
} from '@/lib/serial/aimotor/controller'
import { AI_MOTOR_BAUD, MODE_LABEL, STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

const MODES = [5, 6, 7, 8]

export default function ControlBar() {
  const connected = useMotorStore((s) => s.connected)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const errorCode = useMotorStore((s) => s.errorCode)
  const [baud, setBaud] = useState(String(AI_MOTOR_BAUD))
  const [demoOn, setDemoOn] = useState(isDemo())
  const [busy, setBusy] = useState(false)

  const active = connected || demoOn

  async function onConnect() {
    if (!isWebSerialSupported()) {
      alert('当前浏览器不支持 Web Serial（请用 Chrome/Edge）')
      return
    }
    setBusy(true)
    if (demoOn) { stopDemo(); setDemoOn(false) }
    const r = await connect(Number(baud) || AI_MOTOR_BAUD)
    if (!r.ok && r.error) alert(r.error)
    setBusy(false)
  }

  async function onDisconnect() {
    setBusy(true)
    if (demoOn) { stopDemo(); setDemoOn(false) }
    else await disconnect()
    setBusy(false)
  }

  function onDemo() {
    if (demoOn) { stopDemo(); setDemoOn(false) }
    else { startDemo(); setDemoOn(true) }
  }

  async function onMode(m: number) {
    setBusy(true)
    try { await sendCommand('set_mode', { mode: m }) }
    catch (e) { alert(`切换模式失败: ${e}`) }
    setBusy(false)
  }

  async function onEnable() {
    setBusy(true)
    try { await sendCommand('set_motor_state', { on: true }) }
    catch (e) { alert(`启动失败: ${e}`) }
    setBusy(false)
  }

  async function onStop() {
    setBusy(true)
    try { await sendCommand('set_motor_state', { on: false }) }
    catch (e) { alert(`停止失败: ${e}`) }
    setBusy(false)
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, flexShrink: 0, borderBottom: '1px solid var(--cx-border)', gap: 12, flexWrap: 'wrap' }}>
      <Link href="/" className="cx-btn cx-btn-ghost" style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>
        ← 返回聊天
      </Link>
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>手动控制</span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--cx-muted)' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: active ? 'var(--cx-success)' : 'var(--cx-subtle)' }} />
        {active ? '已连接' : '未连接'}
        {connected && <span style={{ color: 'var(--cx-subtle)' }}>{getPortName()}</span>}
        {demoOn && <span style={{ color: 'var(--cx-warning)' }}>演示</span>}
      </span>

      {active && (
        <span data-testid="ctl-status" style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
          {MODE_LABEL[mode] ?? `mode ${mode}`} · {STAGE_LABEL[stage] ?? `stage ${stage}`}
          {errorCode ? ` · err ${errorCode}` : ''}
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input-base"
          data-testid="ctl-baud"
          style={{ width: 120, fontFamily: "'JetBrains Mono',monospace" }}
          value={baud}
          onChange={(e) => setBaud(e.target.value)}
          disabled={active || busy}
          aria-label="波特率"
        />
        {active ? (
          <button className="cx-btn cx-btn-danger" onClick={onDisconnect} disabled={busy} data-testid="ctl-disconnect">断开</button>
        ) : (
          <button className="cx-btn cx-btn-primary" onClick={onConnect} disabled={busy} data-testid="ctl-connect">连接串口</button>
        )}
        <button className={`cx-btn ${demoOn ? 'cx-btn-danger' : 'cx-btn-ghost'}`} onClick={onDemo} data-testid="ctl-demo">
          {demoOn ? '退出演示' : '演示模式'}
        </button>

        {MODES.map((m) => (
          <button
            key={m}
            className={`cx-btn ${m === mode && active ? 'cx-btn-primary' : 'cx-btn-ghost'}`}
            onClick={() => onMode(m)}
            disabled={!active || busy}
            data-testid={`mode-${m}`}
          >
            mode {m}
          </button>
        ))}
        <button className="cx-btn cx-btn-primary" onClick={onEnable} disabled={!active || busy} data-testid="ctl-enable">启动</button>
        <button className="cx-btn cx-btn-danger" onClick={onStop} disabled={!active || busy} data-testid="ctl-stop">停止</button>
      </div>
    </header>
  )
}
