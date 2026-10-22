'use client'

import React, { useState } from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { sendCommand, sendManualParam } from '@/lib/serial/aimotor/controller'
import { getParam } from '@/lib/serial/aimotor/params'
import { IDENT_ERROR_LABEL, IDENT_STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

const BUS_DEFAULT = getParam(40)?.default ?? 24
const POLES_DEFAULT = getParam(41)?.default ?? 5
const MAX_CURRENT_DEFAULT = getParam(42)?.default ?? 5

export default function TestControlPanel() {
  const connected = useMotorStore((s) => s.connected)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const errorCode = useMotorStore((s) => s.errorCode)
  const [bus, setBus] = useState(String(BUS_DEFAULT))
  const [polePairs, setPolePairs] = useState(String(POLES_DEFAULT))
  const [maxCurrent, setMaxCurrent] = useState(String(MAX_CURRENT_DEFAULT))
  const [busy, setBusy] = useState(false)

  async function sendConfig() {
    await sendManualParam(40, Number(bus), 7)
    await sendManualParam(41, Number(polePairs), 7)
    await sendManualParam(42, Number(maxCurrent), 7)
  }

  async function onSendConfig() {
    setBusy(true)
    try {
      await sendConfig()
    } catch (e) {
      alert(`下发配置失败: ${e}`)
    }
    setBusy(false)
  }

  async function onStart() {
    setBusy(true)
    try {
      await sendConfig()
      await sendCommand('set_mode', { mode: 7 })
      await sendCommand('set_motor_state', { on: true })
    } catch (e) {
      alert(`启动辨识失败: ${e}`)
    }
    setBusy(false)
  }

  async function onStop() {
    setBusy(true)
    try {
      await sendCommand('set_motor_state', { on: false })
    } catch (e) {
      alert(`停止失败: ${e}`)
    }
    setBusy(false)
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">mode7 辨识配置</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>辨识母线电压 (V)</span>
          <input className="input-base" data-testid="pe-bus" type="number" value={bus} onChange={(e) => setBus(e.target.value)} disabled={busy} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>极对数</span>
          <input className="input-base" data-testid="pe-pole-pairs" type="number" value={polePairs} onChange={(e) => setPolePairs(e.target.value)} disabled={busy} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>最大测试相电流峰值 (A)</span>
          <input className="input-base" data-testid="pe-max-current" type="number" value={maxCurrent} onChange={(e) => setMaxCurrent(e.target.value)} disabled={busy} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="cx-btn cx-btn-ghost" onClick={onSendConfig} disabled={!connected || busy} data-testid="pe-send-config">
          下发配置
        </button>
        <button className="cx-btn cx-btn-primary" onClick={onStart} disabled={!connected || busy} data-testid="pe-start">
          开始辨识
        </button>
        <button className="cx-btn cx-btn-danger" onClick={onStop} disabled={!connected || busy} data-testid="pe-stop">
          停止
        </button>
      </div>

      <div data-testid="pe-stage" style={{ marginTop: 12, fontSize: 12, color: 'var(--cx-subtle)' }}>
        状态：{mode === 7 ? `mode7 · ${IDENT_STAGE_LABEL[stage] ?? stage}` : `mode ${mode} · stage ${stage}`}
        {errorCode ? ` · ${IDENT_ERROR_LABEL[errorCode] ?? `err ${errorCode}`}` : ''}
      </div>
    </section>
  )
}
