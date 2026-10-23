'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { IDENT_STAGE_LABEL, MODE_LABEL, STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

export default function ControlSignals() {
  const rpm = useMotorStore((s) => s.status.rpm)
  const iq = useMotorStore((s) => s.iq)
  const emf = useMotorStore((s) => s.lastSample?.emf)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const flags = useMotorStore((s) => s.flags)
  const errorCode = useMotorStore((s) => s.errorCode)

  const cards = [
    { label: '实际估速', value: rpm.toFixed(0), unit: 'rpm', testid: 'card-speed' },
    { label: 'Iq 实测', value: iq.toFixed(3), unit: 'A', testid: 'card-iq' },
    { label: '反电势幅值', value: emf === undefined ? '—' : emf.toFixed(3), unit: 'V', testid: 'card-emf' }
  ]

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>{c.label}</div>
            <div data-testid={c.testid} style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{c.value}</div>
            <div style={{ fontSize: 10, color: 'var(--cx-subtle)' }}>{c.unit}</div>
          </div>
        ))}
      </div>
      <div data-testid="control-state" style={{ marginTop: 10, fontSize: 12, color: 'var(--cx-muted)' }}>
        {MODE_LABEL[mode] ?? `mode ${mode}`} · {mode === 7 ? IDENT_STAGE_LABEL[stage] ?? stage : STAGE_LABEL[stage] ?? `stage ${stage}`}
        {' · '}flags {flags}{errorCode ? ` · err ${errorCode}` : ''}
      </div>
    </section>
  )
}
