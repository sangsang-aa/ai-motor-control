'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useMotorStore } from '@/lib/stores/motorStore'
import { connect, disconnect, getPortName, isWebSerialSupported } from '@/lib/serial/aimotor/controller'
import { AI_MOTOR_BAUD, MODE_LABEL, STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

export default function ConnectionBar() {
  const connected = useMotorStore((s) => s.connected)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const errorCode = useMotorStore((s) => s.errorCode)
  const [baud, setBaud] = useState(String(AI_MOTOR_BAUD))
  const [busy, setBusy] = useState(false)

  async function onConnect() {
    if (!isWebSerialSupported()) {
      alert('当前浏览器不支持 Web Serial（请用 Chrome/Edge）')
      return
    }
    setBusy(true)
    const r = await connect(Number(baud) || AI_MOTOR_BAUD)
    if (!r.ok && r.error) alert(r.error)
    setBusy(false)
  }

  async function onDisconnect() {
    setBusy(true)
    await disconnect()
    setBusy(false)
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, flexShrink: 0, borderBottom: '1px solid var(--cx-border)', gap: 12 }}>
      <Link href="/" className="cx-btn cx-btn-ghost" style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>
        ← 返回聊天
      </Link>
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>PMSM 参数辨识 · mode7</span>

      <span style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--cx-muted)' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--cx-success)' : 'var(--cx-subtle)' }} />
        {connected ? '已连接' : '未连接'}
        {connected && <span style={{ color: 'var(--cx-subtle)' }}>{getPortName()}</span>}
      </span>

      {connected && (
        <span data-testid="pe-mode" style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
          {MODE_LABEL[mode] ?? `mode ${mode}`} · {STAGE_LABEL[stage] ?? `stage ${stage}`}
          {errorCode ? ` · err ${errorCode}` : ''}
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="input-base"
          data-testid="pe-baud"
          style={{ width: 130, fontFamily: "'JetBrains Mono',monospace" }}
          value={baud}
          onChange={(e) => setBaud(e.target.value)}
          disabled={connected || busy}
          aria-label="波特率"
        />
        {connected ? (
          <button className="cx-btn cx-btn-danger" onClick={onDisconnect} disabled={busy} data-testid="pe-disconnect">
            断开
          </button>
        ) : (
          <button className="cx-btn cx-btn-primary" onClick={onConnect} disabled={busy} data-testid="pe-connect">
            连接串口
          </button>
        )}
      </div>
    </header>
  )
}
