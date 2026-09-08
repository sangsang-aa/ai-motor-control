// 5kHz 电流波形面板(独立 100 点批次)— 订阅 waveStore,Canvas/SVG 渲染

'use client'

import React from 'react'
import { useWaveStore } from '@/lib/stores/waveStore'

const W = 640
const H = 200
const PAD = 8

export const WavePanel: React.FC = () => {
  const { samples, batch, hasData } = useWaveStore()

  const min = samples.length ? Math.min(...samples) : 0
  const max = samples.length ? Math.max(...samples) : 1
  const range = max - min || 1

  const iw = W - PAD * 2
  const ih = H - PAD * 2
  const pts = samples.map((v, i) => {
    const x = PAD + (i / (samples.length - 1 || 1)) * iw
    const y = PAD + ih - ((v - min) / range) * ih
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')

  return (
    <div style={{ border: '1px solid #2a2a2a', borderRadius: 8, padding: 8, background: '#111111' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ececec' }}>电流波形 (5kHz)</span>
        {hasData && <span style={{ fontSize: 10, color: '#6b7075' }}>batch #{batch}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9aa0a6' }}>
          {samples.length ? `${min.toFixed(2)} ~ ${max.toFixed(2)} A` : '等待数据'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', background: '#0d0d0d', borderRadius: 4 }}>
        {/* 网格 */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={PAD} y1={PAD + ih * r} x2={W - PAD} y2={PAD + ih * r} stroke="#2a2a2a" strokeWidth={0.5} />
        ))}
        {hasData && pts.length > 1 && (
          <polyline points={polyline} fill="none" stroke="#2bb8a8" strokeWidth={1.5} />
        )}
        {!hasData && <text x={W / 2} y={H / 2} fill="#6b7075" fontSize={12} textAnchor="middle">无波形数据</text>}
      </svg>
    </div>
  )
}
