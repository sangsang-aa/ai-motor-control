import { useEffect, useRef, useState } from 'react'
import { useScopeStore, autoColor, SAMPLE_TIME_S } from '../store/scopeStore'

/** Padding inside the SVG (top, right, bottom, left) */
const PAD = { top: 20, right: 160, bottom: 36, left: 60 }

/**
 * Format a number for display.
 *   - abs < 1e-3 → "0"
 *   - abs >= 1000 → toPrecision(4)
 *   - otherwise → toFixed with adaptive decimals
 */
function fmtNum(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs < 1e-3) return '0'
  if (abs >= 1000) return v.toPrecision(4)
  const dec = abs >= 1 ? 2 : abs >= 0.1 ? 3 : abs >= 0.01 ? 4 : 5
  return v.toFixed(dec)
}

export default function ScopeChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 300 })
  const [, setTick] = useState(0)
  const rafRef = useRef(0)

  // Store subscriptions (re-sub on every render triggered by tick)
  const channels = useScopeStore((s) => s.channels)
  const buffers = useScopeStore((s) => s.buffers)
  const n = useScopeStore((s) => s.n)
  const filled = useScopeStore((s) => s.filled)
  const span = useScopeStore((s) => s.span)
  const spanUnit = useScopeStore((s) => s.spanUnit)

  // ── ResizeObserver ──────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setDims({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── rAF loop ────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const { w, h } = dims
  const iw = w - PAD.left - PAD.right // inner width
  const ih = h - PAD.top - PAD.bottom // inner height

  // Guard against invisible container
  if (iw <= 0 || ih <= 0) {
    return <div ref={containerRef} className="w-full h-full" />
  }

  const startIdx = Math.max(0, n - filled)
  const centerY = PAD.top + ih / 2

  // ── Grid lines → 5 horizontal / 8 time divisions ──────
  const hGridLines = Array.from({ length: 6 }, (_, i) => {
    const y = PAD.top + (i / 5) * ih
    return y.toFixed(1)
  })
  const vGridLines = Array.from({ length: 9 }, (_, i) => {
    const x = PAD.left + (i / 8) * iw
    return x.toFixed(1)
  })

  // ── Build waveform paths & legend data ─────────────────
  const paths: { d: string; color: string }[] = []
  const legend: { color: string; label: string; value: number }[] = []

  for (let ci = 0; ci < channels.length; ci++) {
    const ch = channels[ci]
    if (!ch.enabled) continue

    const buf = buffers[ci]
    if (!buf || buf.length === 0) continue

    const color = ch.colorOverride ?? autoColor(ci)
    const lastVal = buf[n - 1] ?? 0
    legend.push({
      color,
      label: ch.label || ch.name || `CH${ci + 1}`,
      value: lastVal
    })

    // Build SVG path string
    const len = n
    const range = Math.max(1, len - 1 - startIdx)
    let d = ''
    for (let i = startIdx; i < len; i++) {
      const v = buf[i]
      if (!Number.isFinite(v)) continue
      const x = PAD.left + ((i - startIdx) / range) * iw
      const y = centerY - (ch.bias + v / ch.yRange) * (ih / 5)
      if (d === '') {
        d = `M ${x.toFixed(1)} ${y.toFixed(1)}`
      } else {
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      }
    }
    if (d) paths.push({ d, color })
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Background */}
        <rect x={0} y={0} width={w} height={h} fill="#1e1e2e" />

        {/* Horizontal grid lines */}
        {hGridLines.map((y, i) => (
          <line
            key={`hg${i}`}
            x1={PAD.left}
            y1={y}
            x2={w - PAD.right}
            y2={y}
            stroke="#2a2a3c"
            strokeWidth={i === 3 ? 1 : 0.5 /* centre line slightly brighter */}
          />
        ))}

        {/* Vertical grid lines */}
        {vGridLines.map((x, i) => (
          <line
            key={`vg${i}`}
            x1={x}
            y1={PAD.top}
            x2={x}
            y2={h - PAD.bottom}
            stroke="#2a2a3c"
            strokeWidth={0.5}
          />
        ))}

        {/* Border rect */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={iw}
          height={ih}
          fill="none"
          stroke="#33334a"
          strokeWidth={1}
        />

        {/* Y-axis labels (top and bottom values) */}
        {channels.filter(c => c.enabled).length > 0 && (() => {
          const ch = channels.find(c => c.enabled)!
          const topVal = ch.bias * ch.yRange + ch.yRange * 2.5
          const botVal = ch.bias * ch.yRange - ch.yRange * 2.5
          return (
            <g>
              <text x={PAD.left - 4} y={PAD.top + 10} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">
                {fmtNum(topVal)}
              </text>
              <text x={PAD.left - 4} y={h - PAD.bottom - 2} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">
                {fmtNum(botVal)}
              </text>
              <text x={PAD.left - 4} y={centerY + 3} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">
                {fmtNum(ch.bias * ch.yRange)}
              </text>
            </g>
          )
        })()}

        {/* X-axis time tick labels */}
        {vGridLines.map((x, i) => {
          const t = (i / 8) * span
          return (
            <text
              key={`xt${i}`}
              x={x}
              y={h - PAD.bottom + 14}
              fill="#71717a"
              fontSize={9}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {fmtNum(t)} {spanUnit}
            </text>
          )
        })}

        {/* Waveform paths */}
        {paths.map((p, i) => (
          <path
            key={`wf${i}`}
            d={p.d}
            stroke={p.color}
            strokeWidth={1.5}
            fill="none"
          />
        ))}

        {/* Zero markers + channel labels */}
        {channels.map((ch, ci) => {
          if (!ch.enabled) return null
          const color = ch.colorOverride ?? autoColor(ci)
          const y0 = centerY - ch.bias * (ih / 5)
          return (
            <g key={`zm${ci}`}>
              <line
                x1={PAD.left + 4}
                y1={y0.toFixed(1)}
                x2={(w - PAD.right).toFixed(1)}
                y2={y0.toFixed(1)}
                stroke={color}
                strokeWidth={0.8}
                strokeDasharray="4 3"
                opacity={0.4}
              />
              <text
                x={PAD.left + 8}
                y={(y0 - 3).toFixed(1)}
                fill={color}
                fontSize={10}
                fontFamily="monospace"
                opacity={0.8}
              >
                {ch.label || ch.name}
              </text>
            </g>
          )
        })}

        {/* Legend overlay (top-right) */}
        {legend.length > 0 && (
          <g>
            <rect
              x={w - PAD.right + 8}
              y={PAD.top + 4}
              width={PAD.right - 16}
              height={legend.length * 24 + 8}
              rx={4}
              fill="#1e1e2e"
              opacity={0.82}
            />
            {legend.map((item, i) => (
              <g key={`leg${i}`}>
                {/* Color swatch */}
                <rect
                  x={w - PAD.right + 14}
                  y={PAD.top + 8 + i * 24}
                  width={10}
                  height={10}
                  rx={2}
                  fill={item.color}
                />
                {/* Label */}
                <text
                  x={w - PAD.right + 28}
                  y={PAD.top + 17 + i * 24}
                  fill="#e4e4e7"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {item.label.length > 11
                    ? item.label.slice(0, 11) + '\u2026'
                    : item.label}
                </text>
                {/* Value */}
                <text
                  x={w - PAD.right + 14}
                  y={PAD.top + 28 + i * 24}
                  fill="#71717a"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {fmtNum(item.value)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
