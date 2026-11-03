'use client'

import React from 'react'
import type { TekChannel } from '@/lib/tekhsi/types'
import { formatTime } from '@/lib/tekhsi/decode'

export default function NetScopeMeta({
  channels,
  capturedAt
}: {
  channels: TekChannel[]
  capturedAt: number
}) {
  if (!channels.length) return null
  return (
    <section className="cx-panel" style={{ padding: 16 }} data-testid="net-meta">
      <div className="cx-panel-title">采集信息</div>
      <div style={{ fontSize: 11, color: 'var(--cx-subtle)', marginBottom: 8 }}>
        采集时间 {new Date(capturedAt).toLocaleString()}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: 'var(--cx-subtle)', textAlign: 'left' }}>
              <th style={{ padding: '4px 8px' }}>通道</th>
              <th style={{ padding: '4px 8px' }}>记录点数</th>
              <th style={{ padding: '4px 8px' }}>解码点数</th>
              <th style={{ padding: '4px 8px' }}>抽点</th>
              <th style={{ padding: '4px 8px' }}>Δt</th>
              <th style={{ padding: '4px 8px' }}>触发索引</th>
              <th style={{ padding: '4px 8px' }}>y = raw × k + b</th>
              <th style={{ padding: '4px 8px' }}>单位</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.name} style={{ borderTop: '1px solid var(--cx-border)' }}>
                <td style={{ padding: '5px 8px', fontWeight: 600 }}>{ch.name}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{ch.points}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{ch.samples}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>×{ch.stride}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{formatTime(ch.dt)}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{ch.triggerIndex}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>
                  {ch.ySpacing} / {ch.yOffset}
                </td>
                <td style={{ padding: '5px 8px' }}>{ch.yUnits || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
