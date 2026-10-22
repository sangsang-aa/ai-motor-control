'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { IDENT_ERROR_LABEL } from '@/lib/serial/aimotor/protocol'

function ohm(v: number | undefined): string {
  return v === undefined || !Number.isFinite(v) ? '—' : v.toPrecision(4)
}

function micro(v: number | undefined): string {
  return v === undefined || !Number.isFinite(v) ? '—' : (v * 1e6).toFixed(2)
}

export default function ModelPanel() {
  const model = useMotorStore((s) => s.model)

  const rows: { key: string; label: string; value: string; testid?: string }[] = [
    { key: 'Rs', label: 'Rs (Ω)', value: ohm(model?.rs), testid: 'model-Rs' },
    { key: 'Ld', label: 'Ld (µH)', value: micro(model?.ld), testid: 'model-Ld' },
    { key: 'Lq', label: 'Lq (µH)', value: micro(model?.lq), testid: 'model-Lq' },
    { key: 'Ls', label: 'Ls (µH)', value: micro(model?.ls), testid: 'model-Ls' },
    { key: 'bw', label: '带宽 (Hz)', value: model ? model.bandwidth.toFixed(0) : '—' },
    { key: 'bus', label: '母线 (V)', value: model ? model.bus.toFixed(1) : '—' },
    { key: 'poles', label: '极对数', value: model ? String(model.pole_pairs) : '—' },
    { key: 'kpd', label: 'Kp_d', value: model ? model.kp_d.toPrecision(4) : '—' },
    { key: 'kid', label: 'Ki_d', value: model ? model.ki_d.toPrecision(4) : '—' },
    { key: 'kpq', label: 'Kp_q', value: model ? model.kp_q.toPrecision(4) : '—' },
    { key: 'kiq', label: 'Ki_q', value: model ? model.ki_q.toPrecision(4) : '—' },
    { key: 'status', label: 'status', value: model ? String(model.status) : '—' },
    { key: 'save', label: 'save_status', value: model ? String(model.save_status) : '—', testid: 'model-save' },
    { key: 'valid', label: 'saved_valid', value: model ? String(model.saved_valid) : '—' },
    { key: 'ident', label: 'ident_error', value: model ? (IDENT_ERROR_LABEL[model.ident_error] ?? String(model.ident_error)) : '—' }
  ]

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">设备已应用模型</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--cx-subtle)' }}>{r.label}</div>
            <div data-testid={r.testid} style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{r.value}</div>
          </div>
        ))}
      </div>
      {!model && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--cx-subtle)' }}>等待 MODEL 帧(100ms)…</div>}
    </section>
  )
}
