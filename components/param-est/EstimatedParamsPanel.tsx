'use client'

import React from 'react'
import { useParamEstStore } from '@/lib/stores/paramEstStore'
import { clearResults as clearControllerResults } from '@/lib/serial/paramEstController'
import { PM_TEST_LABEL, type ParamEstResult } from '@/lib/types'

const FIELDS: { key: keyof ParamEstResult; unit: string }[] = [
  { key: 'Rs', unit: 'Ω' },
  { key: 'Ld', unit: 'H' },
  { key: 'Lq', unit: 'H' },
  { key: 'Ke', unit: 'Vpk_LL/krpm' },
  { key: 'J', unit: 'kg·m²' },
  { key: 'B', unit: 'N·m·s' }
]

function fmt(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return '—'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs < 1e-3 || abs >= 1e5) return v.toExponential(4)
  return v.toPrecision(6)
}

export default function EstimatedParamsPanel() {
  const test = useParamEstStore((s) => s.control.test)
  const result = useParamEstStore((s) => s.result)
  const quality = useParamEstStore((s) => s.quality)
  const acquiring = useParamEstStore((s) => s.acquiring)
  const frames = useParamEstStore((s) => s.frames)
  const blocks = useParamEstStore((s) => s.blocks)
  const dataError = useParamEstStore((s) => s.dataError)
  const clearResults = useParamEstStore((s) => s.clearResults)

  function onClear() {
    clearResults()
    clearControllerResults()
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title" style={{ display: 'flex', alignItems: 'center' }}>
        估计参数
        <button
          className="cx-btn cx-btn-ghost"
          style={{ marginLeft: 'auto', fontWeight: 400 }}
          onClick={onClear}
          data-testid="clear-results"
        >
          清空
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--cx-muted)', marginBottom: 10 }}>
        活动测试：<span style={{ color: 'var(--cx-text)' }}>{PM_TEST_LABEL[test]}</span>
      </div>

      {acquiring && (
        <div data-testid="acquiring" style={{ fontSize: 12, color: 'var(--cx-warning)', marginBottom: 10 }}>
          采集中… 帧 {frames} · 完整块 {blocks}
        </div>
      )}

      {dataError && (
        <div
          data-testid="data-error"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--cx-danger)',
            background: 'rgba(255,95,87,0.10)',
            border: '1px solid rgba(255,95,87,0.3)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 10
          }}
        >
          {dataError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
              {f.key} <span style={{ opacity: 0.7 }}>({f.unit})</span>
            </div>
            <div
              data-testid={`res-${f.key}`}
              style={{ fontSize: 16, fontFamily: "'JetBrains Mono',monospace", color: 'var(--cx-text)', marginTop: 4 }}
            >
              {fmt(result?.[f.key])}
            </div>
          </div>
        ))}
      </div>

      {quality && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--cx-subtle)' }}>
          数据判定：完整性 {quality.complete ? '通过' : '不合格'} · 有效性 {quality.valid ? '通过' : '不合格'}
          {quality.reason ? `（${quality.reason}）` : ''}
        </div>
      )}
    </section>
  )
}
