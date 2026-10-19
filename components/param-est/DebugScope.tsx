'use client'

import React from 'react'
import { useParamEstStore } from '@/lib/stores/paramEstStore'

const W = 440
const H = 200
const PAD = 8

function toPath(values: number[], min: number, max: number): string {
  if (values.length < 2) return ''
  const span = max - min || 1
  const step = (W - PAD * 2) / (values.length - 1)
  return values
    .map((v, i) => {
      const x = PAD + i * step
      const y = PAD + (H - PAD * 2) * (1 - (v - min) / span)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export default function DebugScope() {
  const waveform = useParamEstStore((s) => s.waveform)

  const all = waveform ? [...waveform.a, ...waveform.b] : []
  const min = all.length ? Math.min(...all) : 0
  const max = all.length ? Math.max(...all) : 1

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">采集波形（通道 A / B）</div>
      {!waveform || all.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--cx-subtle)', padding: '24px 0', textAlign: 'center' }}>
          暂无采集数据
        </div>
      ) : (
        <svg data-testid="wave-scope" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
          <rect x="0" y="0" width={W} height={H} fill="var(--cx-surface-2)" rx="8" />
          <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.06)" />
          <path d={toPath(waveform.a, min, max)} fill="none" stroke="#58a6ff" strokeWidth="1.4" />
          <path d={toPath(waveform.b, min, max)} fill="none" stroke="#febc2e" strokeWidth="1.4" />
        </svg>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: 'var(--cx-subtle)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 3, background: '#58a6ff', display: 'inline-block' }} />通道 A
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 3, background: '#febc2e', display: 'inline-block' }} />通道 B
        </span>
        {waveform && <span style={{ marginLeft: 'auto' }}>{waveform.a.length} 点</span>}
      </div>
    </section>
  )
}
