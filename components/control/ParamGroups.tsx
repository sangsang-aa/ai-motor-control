'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useMotorStore } from '@/lib/stores/motorStore'
import { requestConfig, sendManualParam } from '@/lib/serial/aimotor/controller'
import { AIMOTOR_PARAMS } from '@/lib/serial/aimotor/params'
import { groupParams, isSafetyParam, paramMode } from '@/lib/serial/aimotor/control'

export default function ParamGroups() {
  const connected = useMotorStore((s) => s.connected)
  const mode = useMotorStore((s) => s.mode)
  const flags = useMotorStore((s) => s.flags)
  const config = useMotorStore((s) => s.config)
  const enabled = (flags & 1) !== 0
  const groups = useMemo(() => groupParams(), [])
  const [active, setActive] = useState(0)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const d of AIMOTOR_PARAMS) {
        if (next[d.id] !== undefined) continue
        const rec = config.find((r) => r.param === d.id)
        next[d.id] = String(rec?.value ?? d.default)
      }
      return next
    })
  }, [config])

  const current = (id: number) => config.find((r) => r.param === id)?.value
  const valueOf = (id: number, fallback: number) => drafts[id] ?? String(current(id) ?? fallback)

  async function reload() {
    setBusy(true)
    try { await requestConfig() }
    catch (e) { alert(`回读失败: ${e}`) }
    setBusy(false)
  }

  async function applyGroup() {
    const params = groups[active].params
    const differs = (a: number, b: number) => Math.abs(a - b) > Math.max(1e-9, Math.abs(b) * 1e-6)
    const changes = params.filter((d) => {
      const v = Number(valueOf(d.id, d.default))
      const cur = current(d.id) ?? d.default
      return Number.isFinite(v) && differs(v, cur)
    })
    if (!changes.length) return
    if (changes.some((d) => isSafetyParam(d.id)) &&
      !confirm('本组包含安全限制参数(强拖上限 / 闭环 Iq / 辨识电流 / 参数组 / 自动应用),确认写入?')) {
      return
    }
    setBusy(true)
    try {
      for (const d of changes) {
        await sendManualParam(d.id, Number(valueOf(d.id, d.default)), paramMode(d, mode))
      }
      await requestConfig()
    } catch (e) {
      alert(`应用失败: ${e}`)
    }
    setBusy(false)
  }

  function resetGroup() {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const d of groups[active].params) next[d.id] = String(d.default)
      return next
    })
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        参数调控
        <span data-testid="config-count" style={{ fontWeight: 400, fontSize: 11, color: 'var(--cx-subtle)' }}>
          已回读 {config.length} 条
        </span>
        <button className="cx-btn cx-btn-ghost" style={{ marginLeft: 'auto' }} onClick={reload} disabled={!connected || busy} data-testid="reload-config">
          回读配置
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {groups.map((g, i) => (
          <button
            key={g.group}
            className={`cx-btn ${i === active ? 'cx-btn-primary' : 'cx-btn-ghost'}`}
            onClick={() => setActive(i)}
            data-testid={`group-tab-${i}`}
          >
            {g.group}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups[active].params.map((d) => {
          const blocked = enabled && !d.live
          return (
            <div
              key={d.id}
              style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: 10, alignItems: 'center', background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '8px 10px' }}
            >
              <div>
                <div style={{ fontSize: 12.5 }}>
                  {d.label}
                  {isSafetyParam(d.id) && <span style={{ color: 'var(--cx-warning)', fontSize: 10, marginLeft: 6 }}>安全</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--cx-subtle)' }}>
                  #{d.id} · {d.min}..{d.max} {d.unit} · {d.live ? '可在线改' : '需停机'}
                </div>
              </div>
              <input
                className="input-base"
                data-testid={`param-${d.id}`}
                type="number"
                value={valueOf(d.id, d.default)}
                onChange={(e) => setDrafts((p) => ({ ...p, [d.id]: e.target.value }))}
                disabled={!connected || busy || blocked}
              />
              <button
                className="cx-btn cx-btn-ghost"
                onClick={() => setDrafts((p) => ({ ...p, [d.id]: String(d.default) }))}
                disabled={busy}
              >
                默认
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="cx-btn cx-btn-primary" onClick={applyGroup} disabled={!connected || busy} data-testid="apply-group">
          应用本组修改
        </button>
        <button className="cx-btn cx-btn-ghost" onClick={resetGroup} disabled={busy}>
          本组恢复默认
        </button>
        {enabled && <span style={{ fontSize: 11, color: 'var(--cx-warning)' }}>运行中:仅 live 参数可改,其它需先停机</span>}
      </div>
    </section>
  )
}
