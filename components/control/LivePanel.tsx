'use client'

import React from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { IDENT_STAGE_LABEL, STAGE_LABEL } from '@/lib/serial/aimotor/protocol'

const FIELDS: { key: 'reference' | 'speed' | 'id_ref' | 'id' | 'iq_ref' | 'iq' | 'iu' | 'iv' | 'iw' | 'angle' | 'emf' | 'if_speed'; label: string; unit: string; digits: number }[] = [
  { key: 'reference', label: 'reference', unit: 'rpm', digits: 0 },
  { key: 'speed', label: 'speed', unit: 'rpm', digits: 0 },
  { key: 'id_ref', label: 'id_ref', unit: 'A', digits: 3 },
  { key: 'id', label: 'id', unit: 'A', digits: 3 },
  { key: 'iq_ref', label: 'iq_ref', unit: 'A', digits: 3 },
  { key: 'iq', label: 'iq', unit: 'A', digits: 3 },
  { key: 'iu', label: 'iu', unit: 'A', digits: 3 },
  { key: 'iv', label: 'iv', unit: 'A', digits: 3 },
  { key: 'iw', label: 'iw', unit: 'A', digits: 3 },
  { key: 'angle', label: 'angle', unit: 'rad', digits: 3 },
  { key: 'emf', label: 'emf', unit: 'V', digits: 3 },
  { key: 'if_speed', label: 'if_speed', unit: 'rpm', digits: 0 }
]

export default function LivePanel() {
  const sample = useMotorStore((s) => s.lastSample)
  const mode = useMotorStore((s) => s.mode)
  const stage = useMotorStore((s) => s.stage)
  const flags = useMotorStore((s) => s.flags)
  const errorCode = useMotorStore((s) => s.errorCode)

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">实时量</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--cx-subtle)' }}>{f.label} ({f.unit})</div>
            <div data-testid={`live-${f.key}`} style={{ fontSize: 14, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
              {sample ? sample[f.key].toFixed(f.digits) : '—'}
            </div>
          </div>
        ))}
      </div>
      <div data-testid="live-stage" style={{ marginTop: 10, fontSize: 11, color: 'var(--cx-subtle)' }}>
        mode {mode} · {mode === 7 ? IDENT_STAGE_LABEL[stage] ?? stage : STAGE_LABEL[stage] ?? `stage ${stage}`}
        {' · '}flags {flags}{errorCode ? ` · err ${errorCode}` : ''}
      </div>
    </section>
  )
}
