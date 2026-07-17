import { useState, useEffect, useRef } from 'react'
import {
  useScopeStore,
  autoColor,
  getEffectiveBiasRange,
  getEffectiveVdivRange
} from '../store/scopeStore'
import { computeStats } from '../lib/stats'
import type { ChannelCfg } from '../store/scopeStore'

// ── Helpers ──────────────────────────────────────────────────────

function fmtNum(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs < 1e-3) return '0'
  if (abs >= 1000) return v.toPrecision(4)
  const dec = abs >= 1 ? 2 : abs >= 0.1 ? 3 : abs >= 0.01 ? 4 : 5
  return v.toFixed(dec)
}

// ── LabelEditor ──────────────────────────────────────────────────

function LabelEditor({ ch, idx }: { ch: ChannelCfg; idx: number }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const setChannelLabel = useScopeStore((s) => s.setChannelLabel)

  const display = ch.label || ch.name

  const startEdit = () => {
    setDraft(display)
    setEditing(true)
  }

  const commit = () => {
    const trimmed = draft.trim()
    // If user cleared the label, set empty → falls back to name
    setChannelLabel(idx, trimmed === ch.name ? '' : trimmed)
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        className="flex-1 min-w-0 px-1 py-0 rounded bg-surface text-text-primary text-xs font-mono border border-accent/50 outline-none"
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className="flex-1 min-w-0 truncate cursor-pointer text-xs font-mono text-text-primary hover:text-accent transition-colors"
      title="Click to edit label"
    >
      {display}
    </span>
  )
}

// ── LimitInput ──────────────────────────────────────────────────

function LimitInput({
  ch,
  idx,
  kind,
  label
}: {
  ch: ChannelCfg
  idx: number
  kind: 'bias' | 'vdiv'
  label: string
}) {
  const range =
    kind === 'bias' ? getEffectiveBiasRange(ch) : getEffectiveVdivRange(ch)
  const setChannelRange = useScopeStore((s) => s.setChannelRange)

  const [minStr, setMinStr] = useState(String(range.min))
  const [maxStr, setMaxStr] = useState(String(range.max))

  // Sync when external range changes (e.g., reset button)
  useEffect(() => {
    setMinStr(String(range.min))
    setMaxStr(String(range.max))
  }, [range.min, range.max])

  const commit = () => {
    const min = parseFloat(minStr)
    const max = parseFloat(maxStr)
    if (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min < max &&
      (kind === 'vdiv' ? min > 0 : true)
    ) {
      setChannelRange(idx, kind, { min, max })
    } else {
      // Revert on invalid
      setMinStr(String(range.min))
      setMaxStr(String(range.max))
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-text-secondary mr-0.5">{label}</span>
      <input
        value={minStr}
        onChange={(e) => setMinStr(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setMinStr(String(range.min))
            setMaxStr(String(range.max))
          }
        }}
        className="w-12 px-0.5 py-0 rounded bg-surface text-text-primary text-[10px] font-mono border border-surface-lighter text-center"
      />
      <span className="text-[10px] text-text-secondary">\u2013</span>
      <input
        value={maxStr}
        onChange={(e) => setMaxStr(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setMinStr(String(range.min))
            setMaxStr(String(range.max))
          }
        }}
        className="w-12 px-0.5 py-0 rounded bg-surface text-text-primary text-[10px] font-mono border border-surface-lighter text-center"
      />
    </div>
  )
}

// ── ValueRow ─────────────────────────────────────────────────────

function ValueRow({ ch, idx }: { ch: ChannelCfg; idx: number }) {
  const buffers = useScopeStore((s) => s.buffers)
  const n = useScopeStore((s) => s.n)
  const setChannelBias = useScopeStore((s) => s.setChannelBias)
  const setChannelYRange = useScopeStore((s) => s.setChannelYRange)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const buf = buffers[idx]
  const lastVal = buf?.[n - 1] ?? 0
  const display = `${fmtNum(lastVal)} ${ch.unit}`.trim()

  const startEdit = () => {
    setDraft(String(lastVal))
    setEditing(true)
  }

  const commit = () => {
    const v = parseFloat(draft)
    if (Number.isFinite(v)) {
      // No way to know if user intended bias or yRange from a single value,
      // so we do nothing special — the editable value is read-only for info.
      // The task says "clamps to range" — we clamp bias range.
      const biasRange = getEffectiveBiasRange(ch)
      const clamped = Math.max(biasRange.min, Math.min(biasRange.max, v))
      setChannelBias(idx, clamped)
    }
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        className="w-full px-1 py-0 rounded bg-surface text-text-primary text-[11px] font-mono border border-accent/50 outline-none"
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className="block text-[11px] font-mono text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
      title="Click to edit bias value"
    >
      {display}
    </span>
  )
}

// ── ChannelRow ───────────────────────────────────────────────────

function ChannelRow({ ch, idx }: { ch: ChannelCfg; idx: number }) {
  const buffers = useScopeStore((s) => s.buffers)
  const n = useScopeStore((s) => s.n)
  const filled = useScopeStore((s) => s.filled)
  const setChannelEnabled = useScopeStore((s) => s.setChannelEnabled)
  const setChannelBias = useScopeStore((s) => s.setChannelBias)
  const setChannelYRange = useScopeStore((s) => s.setChannelYRange)
  const setChannelColor = useScopeStore((s) => s.setChannelColor)
  const setChannelRange = useScopeStore((s) => s.setChannelRange)

  const color = ch.colorOverride ?? autoColor(idx)
  const isUnused = !ch.enabled && !ch.label && !ch.unit && ch.name.startsWith('CH')
  const hasData = buffers[idx] && buffers[idx].length > 0

  // Stats
  const stats = hasData ? computeStats(buffers[idx], n, filled) : null

  // Bias range & position
  const biasRange = getEffectiveBiasRange(ch)
  const biasPct =
    biasRange.max !== biasRange.min
      ? ((ch.bias - biasRange.min) / (biasRange.max - biasRange.min)) * 100
      : 50

  // V/div logarithmic slider
  const vdivRange = getEffectiveVdivRange(ch)
  const logMin = Math.log10(vdivRange.min)
  const logMax = Math.log10(vdivRange.max)
  const logSpan = logMax - logMin
  const vdivPos =
    logSpan > 0 ? (Math.log10(ch.yRange) - logMin) / logSpan : 0.5
  const vdivPct = vdivPos * 100

  const handleVdivSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value) / 100
    const yr = Math.pow(10, pct * logSpan + logMin)
    setChannelYRange(idx, yr)
  }

  const opacity = isUnused ? 'opacity-30' : ''

  return (
    <div className={`border-b border-surface-lighter px-2 py-1.5 ${opacity}`}>
      {/* ── Header: checkbox + label + color ────────────── */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={ch.enabled}
          onChange={(e) => setChannelEnabled(idx, e.target.checked)}
          className="accent-accent shrink-0"
        />
        <LabelEditor ch={ch} idx={idx} />

        {/* Color picker + reset */}
        <div className="flex items-center gap-0.5 shrink-0">
          <input
            type="color"
            value={color}
            onChange={(e) => setChannelColor(idx, e.target.value)}
            className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
            title="Channel color"
          />
          {ch.colorOverride && (
            <button
              onClick={() => setChannelColor(idx, null)}
              className="text-[10px] text-text-secondary hover:text-text-primary px-0.5"
              title="Reset to auto color"
            >
              \u21BA
            </button>
          )}
        </div>
      </div>

      {/* ── Bias slider row ────────────────────────────── */}
      <div className="flex items-center gap-1 mt-1">
        <LimitInput ch={ch} idx={idx} kind="bias" label="B" />
        <input
          type="range"
          min={biasRange.min}
          max={biasRange.max}
          step={0.01}
          value={ch.bias}
          onChange={(e) => setChannelBias(idx, Number(e.target.value))}
          className="flex-1 h-3 accent-accent"
          title={`Bias: ${fmtNum(ch.bias)} div`}
        />
        <span className="text-[10px] font-mono text-text-secondary w-10 text-right">
          {fmtNum(ch.bias)}
        </span>
        <button
          onClick={() => setChannelRange(idx, 'bias', null)}
          className="text-[11px] text-text-secondary hover:text-text-primary px-0.5"
          title="Reset bias to defaults"
        >
          \u21BA
        </button>
      </div>

      {/* ── Value readout ──────────────────────────────── */}
      {ch.enabled && (
        <div className="mt-0.5">
          <ValueRow ch={ch} idx={idx} />
        </div>
      )}

      {/* ── V/div slider row ───────────────────────────── */}
      <div className="flex items-center gap-1 mt-1">
        <LimitInput ch={ch} idx={idx} kind="vdiv" label="V" />
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={vdivPct}
          onChange={handleVdivSlider}
          className="flex-1 h-3 accent-accent"
          title={`V/div: ${fmtNum(ch.yRange)} ${ch.unit}`}
        />
        <span className="text-[10px] font-mono text-text-secondary w-10 text-right">
          {fmtNum(ch.yRange)}
        </span>
        <button
          onClick={() => setChannelRange(idx, 'vdiv', null)}
          className="text-[11px] text-text-secondary hover:text-text-primary px-0.5"
          title="Reset V/div to defaults"
        >
          \u21BA
        </button>
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      {stats && ch.enabled && (
        <div className="text-[10px] text-text-secondary font-mono mt-0.5 flex gap-2">
          <span>
            min:
            {fmtNum(stats.min)}
          </span>
          <span>
            max:
            {fmtNum(stats.max)}
          </span>
          <span>
            avg:
            {fmtNum(stats.avg)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── ChannelPanel (main export) ───────────────────────────────────

export default function ChannelPanel() {
  const channels = useScopeStore((s) => s.channels)

  return (
    <div className="w-full h-full overflow-y-auto bg-surface-light shrink-0">
      {channels.map((ch, i) => (
        <ChannelRow key={i} ch={ch} idx={i} />
      ))}
    </div>
  )
}
