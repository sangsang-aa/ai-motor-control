'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useParamEstStore } from '@/lib/stores/paramEstStore'
import { connect, disconnect } from '@/lib/serial/paramEstController'
import { PARAM_EST_BAUD } from '@/lib/config'

export default function ConnectionBar() {
  const connected = useParamEstStore((s) => s.connected)
  const port = useParamEstStore((s) => s.port)
  const baudRate = useParamEstStore((s) => s.baudRate)
  const errorMessage = useParamEstStore((s) => s.errorMessage)
  const [baud, setBaud] = useState(String(PARAM_EST_BAUD))
  const [busy, setBusy] = useState(false)

  async function onConnect() {
    setBusy(true)
    await connect(Number(baud) || PARAM_EST_BAUD)
    setBusy(false)
  }

  async function onDisconnect() {
    setBusy(true)
    await disconnect()
    setBusy(false)
  }

  const dot = (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: connected ? 'var(--cx-success)' : 'var(--cx-subtle)'
      }}
    />
  )

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        height: 52,
        flexShrink: 0,
        borderBottom: '1px solid var(--cx-border)',
        gap: 12
      }}
    >
      <Link href="/" className="cx-btn cx-btn-ghost" style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>
        ← 返回
      </Link>
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>PMSM 参数辨识</span>

      <span style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--cx-muted)' }}>
        {dot}
        {connected ? '已连接' : '未连接'}
        {connected && <span style={{ color: 'var(--cx-subtle)' }}>{port} @ {baudRate}</span>}
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="input-base"
          style={{ width: 130, fontFamily: "'JetBrains Mono',monospace" }}
          value={baud}
          onChange={(e) => setBaud(e.target.value)}
          disabled={connected || busy}
          aria-label="波特率"
        />
        {connected ? (
          <button className="cx-btn cx-btn-danger" onClick={onDisconnect} disabled={busy}>
            断开
          </button>
        ) : (
          <button className="cx-btn cx-btn-primary" onClick={onConnect} disabled={busy}>
            连接串口
          </button>
        )}
      </div>

      {errorMessage && (
        <span data-testid="conn-error" style={{ fontSize: 12, color: 'var(--cx-danger)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </header>
  )
}
