'use client'

import React, { useState } from 'react'
import type { Sample } from '@/lib/serial/aimotor/protocol'
import { useSampleHistory } from './useSampleHistory'

type Series = { key: keyof Sample; label: string; color: string }

const SPEED_SERIES: Series[] = [
  { key: 'reference', label: '给定', color: '#f59e0b' },
  { key: 'speed', label: '估速', color: '#3b82f6' }
]

const DQ_SERIES: Series[] = [
  { key: 'id', label: 'Id', color: '#22c55e' },
  { key: 'iq', label: 'Iq', color: '#3b82f6' },
  { key: 'iq_ref', label: 'Iq给定', color: '#f59e0b' }
]

const PHASE_SERIES: Series[] = [
  { key: 'iu', label: 'U', color: '#22c55e' },
  { key: 'iv', label: 'V', color: '#3b82f6' },
  { key: 'iw', label: 'W', color: '#f59e0b' }
]

const W = 760
const PAD = { left: 46, right: 12, top: 26, bottom: 22 }

function buildPath(samples: Sample[], series: Series, lo: number, hi: number, height: number): string {
  if (samples.length < 2) return ''
  const iw = W - PAD.left - PAD.right
  const ih = height - PAD.top - PAD.bottom
  const span = hi - lo || 1
  return samples
    .map((s, i) => {
      const v = s[series.key] as number
      if (!Number.isFinite(v)) return ''
      const x = PAD.left + (i / (samples.length - 1)) * iw
      const y = PAD.top + ih * (1 - (v - lo) / span)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .filter(Boolean)
    .join(' ')
}

function MiniPlot({
  title,
  unit,
  series,
  samples,
  height,
  testid
}: {
  title: string
  unit: string
  series: Series[]
  samples: Sample[]
  height: number
  testid: string
}) {
  const window = samples.slice(-1000)
  const values = window.flatMap((s) => series.map((se) => s[se.key] as number)).filter((v) => Number.isFinite(v))
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const margin = Math.max((hi - lo) * 0.12, unit === 'A' ? 0.1 : 50)
  const yLo = lo - margin
  const yHi = hi + margin
  const iw = W - PAD.left - PAD.right
  const ih = height - PAD.top - PAD.bottom

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--cx-subtle)' }}>{unit}</span>
        {series.map((se) => (
          <span key={se.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--cx-muted)' }}>
            <span style={{ width: 12, height: 3, background: se.color, display: 'inline-block' }} />
            {se.label}
          </span>
        ))}
      </div>
      <svg data-testid={testid} viewBox={`0 0 ${W} ${height}`} style={{ display: 'block', width: '100%', height }}>
        <rect x={0} y={0} width={W} height={height} style={{ fill: 'var(--cx-chart-bg)' }} />
        {[0, 1, 2, 3].map((i) => {
          const y = PAD.top + (ih * i) / 3
          const v = yHi - ((yHi - yLo) * i) / 3
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} style={{ stroke: 'var(--cx-chart-grid)' }} strokeWidth={0.6} />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" style={{ fill: 'var(--cx-chart-text)' }} fontSize={9} fontFamily="monospace">
                {unit === 'A' ? v.toFixed(2) : v.toFixed(0)}
              </text>
            </g>
          )
        })}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = PAD.left + (iw * i) / 5
          const sec = (i - 5) * 2
          return (
            <g key={`x${i}`}>
              <line x1={x} y1={PAD.top} x2={x} y2={height - PAD.bottom} style={{ stroke: 'var(--cx-chart-grid)' }} strokeWidth={0.4} />
              <text x={x} y={height - 6} textAnchor="middle" style={{ fill: 'var(--cx-chart-text)' }} fontSize={9} fontFamily="monospace">
                {sec}s
              </text>
            </g>
          )
        })}
        {window.length === 0 && (
          <text x={W / 2} y={height / 2} textAnchor="middle" style={{ fill: 'var(--cx-chart-text)' }} fontSize={12}>
            等待数据 · 未连接不会启动电机
          </text>
        )}
        {series.map((se) => {
          const d = buildPath(window, se, yLo, yHi, height)
          if (!d) return null
          return <path key={se.label} d={d} fill="none" style={{ stroke: se.color }} strokeWidth={1.6} />
        })}
      </svg>
    </div>
  )
}

export default function ControlWaveforms() {
  const { samples, paused, setPaused, clear } = useSampleHistory()
  const [tab, setTab] = useState<'overview' | 'phase'>('overview')

  function exportCurrent() {
    if (samples.length === 0) return
    const header = ['tick', 'mode', 'stage', 'reference', 'speed', 'id_ref', 'id', 'iq_ref', 'iq', 'iu', 'iv', 'iw', 'emf']
    const rows = samples.map((s) => [s.tick, s.mode, s.stage, s.reference, s.speed, s.id_ref, s.id, s.iq_ref, s.iq, s.iu, s.iv, s.iw, s.emf].join(','))
    const blob = new Blob(['\uFEFF' + header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mototune-wave-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        波形
        <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--cx-subtle)' }}>{samples.length} 点 · 100Hz</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="cx-btn cx-btn-ghost" onClick={() => setPaused(!paused)} data-testid="wave-pause">
            {paused ? '继续绘图' : '暂停绘图'}
          </button>
          <button className="cx-btn cx-btn-ghost" onClick={clear} data-testid="wave-clear">清空波形</button>
          <button className="cx-btn cx-btn-ghost" onClick={exportCurrent} data-testid="export-wave-csv">导出当前波形 CSV</button>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button className={`cx-btn ${tab === 'overview' ? 'cx-btn-primary' : 'cx-btn-ghost'}`} onClick={() => setTab('overview')} data-testid="wave-tab-overview">
          速度 / dq 电流
        </button>
        <button className={`cx-btn ${tab === 'phase' ? 'cx-btn-primary' : 'cx-btn-ghost'}`} onClick={() => setTab('phase')} data-testid="wave-tab-phase">
          三相电流
        </button>
      </div>

      {tab === 'overview' ? (
        <>
          <MiniPlot title="速度" unit="rpm" series={SPEED_SERIES} samples={samples} height={180} testid="wave-speed" />
          <MiniPlot title="dq 电流" unit="A" series={DQ_SERIES} samples={samples} height={170} testid="wave-dq" />
        </>
      ) : (
        <>
          <MiniPlot title="三相电流" unit="A" series={PHASE_SERIES} samples={samples} height={360} testid="wave-phase" />
          <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
            100 Hz 瞬时抽样;短时窗仅显示插值,不能用于 PWM 纹波判定。
          </div>
        </>
      )}
    </section>
  )
}
