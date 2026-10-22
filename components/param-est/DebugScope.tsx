'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { IDENT_STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div style={{ background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>{label}</div>
      <div data-testid={testid} style={{ fontSize: 16, fontFamily: "'JetBrains Mono',monospace", color: 'var(--cx-text)', marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

export default function DebugScope() {
  const id = useMotorStore((s) => s.id)
  const iq = useMotorStore((s) => s.iq)
  const speed = useMotorStore((s) => s.status.rpm)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const errorCode = useMotorStore((s) => s.errorCode)

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">辨识实时量</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <Stat label="Id (A)" value={id.toFixed(3)} testid="debug-id" />
        <Stat label="Iq (A)" value={iq.toFixed(3)} testid="debug-iq" />
        <Stat label="Speed (RPM)" value={speed.toFixed(0)} testid="debug-speed" />
      </div>
      <div data-testid="debug-stage" style={{ marginTop: 10, fontSize: 11, color: 'var(--cx-subtle)' }}>
        mode {mode} · {mode === 7 ? IDENT_STAGE_LABEL[stage] ?? stage : `stage ${stage}`}
        {errorCode ? ` · err ${errorCode}` : ''}
      </div>
    </section>
  )
}
