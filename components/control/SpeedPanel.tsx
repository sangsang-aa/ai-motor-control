'use client'

import React, { useState } from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { sendCommand } from '@/lib/serial/aimotor/controller'
import { getParam } from '@/lib/serial/aimotor/params'

export default function SpeedPanel() {
  const connected = useMotorStore((s) => s.connected)
  const rpm = useMotorStore((s) => s.status.rpm)
  const reference = useMotorStore((s) => s.reference)
  const mode = useMotorStore((s) => s.mode)
  const [target, setTarget] = useState(String(getParam(1)?.default ?? 1500))
  const [busy, setBusy] = useState(false)

  async function apply() {
    setBusy(true)
    try { await sendCommand('set_speed', { rpm: Number(target) }) }
    catch (e) { alert(`设置目标失败: ${e}`) }
    setBusy(false)
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">目标转速</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>目标 (RPM, 上限 6000)</span>
          <input className="input-base" data-testid="target-rpm" type="number" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} />
        </label>
        <button className="cx-btn cx-btn-primary" onClick={apply} disabled={!connected || busy} data-testid="apply-speed">应用目标</button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>给定</div>
            <div data-testid="ref-speed" style={{ fontSize: 18, fontFamily: "'JetBrains Mono',monospace" }}>{reference.toFixed(0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>实测/估速</div>
            <div data-testid="speed-live" style={{ fontSize: 18, fontFamily: "'JetBrains Mono',monospace" }}>{rpm.toFixed(0)}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--cx-subtle)' }}>
        当前 mode {mode};运行中改目标会经 `SET_PARAM(param 1)` 下发。
      </div>
    </section>
  )
}
