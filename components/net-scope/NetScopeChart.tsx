'use client'

import React from 'react'
import type { TekChannel } from '@/lib/tekhsi/types'
import { formatTime, formatValue } from '@/lib/tekhsi/decode'
import { useSettingsStore } from '@/lib/settings'
import { autoColor } from '@/lib/stores/scopeStore'

const W = 900
const H = 210
const PAD = { left: 68, right: 18, top: 28, bottom: 30 }

export default function NetScopeChart({ channel, index }: { channel: TekChannel; index: number }) {
  const theme = useSettingsStore((s) => s.settings.theme)
  const color = autoColor(index, theme)
  const y = channel.y

  if (!y.length) {
    return (
      <section className="cx-panel" style={{ padding: 16 }}>
        <div className="cx-panel-title">{channel.name}</div>
        <div style={{ fontSize: 12, color: 'var(--cx-subtle)' }}>该通道没有解码出采样点。</div>
      </section>
    )
  }

  let lo = Infinity
  let hi = -Infinity
  for (const v of y) {
    if (!Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0
    hi = 1
  }
  const margin = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
  const yLo = lo - margin
  const yHi = hi + margin

  const lastIndex = (y.length - 1) * channel.stride
  const xStart = (0 - channel.triggerIndex) * channel.dt
  const xEnd = (lastIndex - channel.triggerIndex) * channel.dt
  const xSpan = xEnd - xStart || 1
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom

  const xPos = (t: number) => PAD.left + ((t - xStart) / xSpan) * iw
  const yPos = (v: number) => PAD.top + ih * (1 - (v - yLo) / (yHi - yLo))

  // Limit SVG work to ~2000 points even if the acquisition is large.
  const step = Math.max(1, Math.floor(y.length / 2000))
  let d = ''
  for (let i = 0; i < y.length; i += step) {
    const v = y[i]
    if (!Number.isFinite(v)) continue
    const px = xPos((i * channel.stride - channel.triggerIndex) * channel.dt)
    const py = yPos(v)
    d += `${d ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`
  }

  const triggerVisible = xStart <= 0 && xEnd >= 0

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{channel.name}</span>
        <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
          {channel.points} 点 · Δt {formatTime(channel.dt)} · {channel.yUnits || '—'}
          {channel.stride > 1 ? ` · 抽点 ×${channel.stride}` : ''}
        </span>
      </div>
      <svg
        data-testid={`net-chart-${channel.name}`}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${channel.name} 波形`}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <rect x={0} y={0} width={W} height={H} style={{ fill: 'var(--cx-chart-bg)' }} />

        {[0, 1, 2, 3, 4].map((i) => {
          const py = PAD.top + (ih * i) / 4
          const v = yHi - ((yHi - yLo) * i) / 4
          return (
            <g key={`y${i}`}>
              <line
                x1={PAD.left}
                y1={py}
                x2={W - PAD.right}
                y2={py}
                style={{ stroke: 'var(--cx-chart-grid)' }}
                strokeWidth={0.6}
              />
              <text
                x={PAD.left - 8}
                y={py + 3}
                textAnchor="end"
                style={{ fill: 'var(--cx-chart-text)' }}
                fontSize={9}
                fontFamily="monospace"
              >
                {formatValue(v)}
              </text>
            </g>
          )
        })}

        {[0, 1, 2, 3, 4, 5].map((i) => {
          const t = xStart + (xSpan * i) / 5
          const px = PAD.left + (iw * i) / 5
          return (
            <g key={`x${i}`}>
              <line
                x1={px}
                y1={PAD.top}
                x2={px}
                y2={H - PAD.bottom}
                style={{ stroke: 'var(--cx-chart-grid)' }}
                strokeWidth={0.4}
              />
              <text
                x={px}
                y={H - 8}
                textAnchor="middle"
                style={{ fill: 'var(--cx-chart-text)' }}
                fontSize={9}
                fontFamily="monospace"
              >
                {formatTime(t)}
              </text>
            </g>
          )
        })}

        {triggerVisible && (
          <line
            x1={xPos(0)}
            y1={PAD.top}
            x2={xPos(0)}
            y2={H - PAD.bottom}
            style={{ stroke: 'var(--cx-subtle)' }}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        <path d={d} fill="none" style={{ stroke: color }} strokeWidth={1.4} />

        <text
          x={W - PAD.right}
          y={PAD.top - 10}
          textAnchor="end"
          style={{ fill: 'var(--cx-chart-text)' }}
          fontSize={10}
          fontFamily="monospace"
        >
          {channel.yUnits || ''}
        </text>
      </svg>
    </section>
  )
}
