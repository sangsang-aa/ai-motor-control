'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { IDENT_ERROR_LABEL, IDENT_STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

function fmtOhm(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  return v.toPrecision(4)
}

function fmtMicro(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  return (v * 1e6).toFixed(2)
}

export default function EstimatedParamsPanel() {
  const model = useMotorStore((s) => s.model)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const errorCode = useMotorStore((s) => s.errorCode)

  const fields = [
    { key: 'Rs', label: 'Rs', unit: 'Ω', value: fmtOhm(model?.rs) },
    { key: 'Ld', label: 'Ld', unit: 'µH', value: fmtMicro(model?.ld) },
    { key: 'Lq', label: 'Lq', unit: 'µH', value: fmtMicro(model?.lq) },
    { key: 'Ls', label: 'Ls', unit: 'µH', value: fmtMicro(model?.ls) }
  ]

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">辨识结果（设备已应用模型）</div>

      <div style={{ fontSize: 12, color: 'var(--cx-muted)', marginBottom: 10 }}>
        阶段：{mode === 7 ? IDENT_STAGE_LABEL[stage] ?? stage : `stage ${stage}`}
        {errorCode ? ` · ${IDENT_ERROR_LABEL[errorCode] ?? `err ${errorCode}`}` : ''}
      </div>

      {errorCode > 0 && (
        <div
          data-testid="pe-error"
          style={{
            fontSize: 13, fontWeight: 700, color: 'var(--cx-danger)',
            background: 'rgba(255,95,87,0.10)', border: '1px solid rgba(255,95,87,0.3)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 10
          }}
        >
          {IDENT_ERROR_LABEL[errorCode] ?? `辨识错误码 ${errorCode}`}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {fields.map((f) => (
          <div key={f.key} style={{ background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
              {f.label} <span style={{ opacity: 0.7 }}>({f.unit})</span>
            </div>
            <div data-testid={`res-${f.key}`} style={{ fontSize: 16, fontFamily: "'JetBrains Mono',monospace", color: 'var(--cx-text)', marginTop: 4 }}>
              {f.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--cx-subtle)', lineHeight: 1.7 }}>
        模型为设备当前已应用参数；辨识完成后请核对 stage/error 与保存状态，再撤销使能。
      </div>
    </section>
  )
}
