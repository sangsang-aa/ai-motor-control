import { useEffect, useRef, useState } from 'react'
import { useScopeStore } from '../store/scopeStore'
import { HEX_BUFFER_BYTES } from '../store/scopeStore'

const BYTES_PER_LINE = 16

export default function HexView() {
  const hexBuf = useScopeStore((s) => s.hexBuf)
  const hexFilled = useScopeStore((s) => s.hexFilled)
  const containerRef = useRef<HTMLDivElement>(null)

  // rAF throttle tick
  const [, setTick] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let last = 0
    const loop = (now: number) => {
      if (now - last >= 33) {
        last = now
        setTick((t) => t + 1)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    const el = containerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })

  // Build lines
  const lines: string[] = []
  const count = Math.min(hexFilled, HEX_BUFFER_BYTES)
  const fullLines = Math.ceil(count / BYTES_PER_LINE)
  for (let line = 0; line < fullLines; line++) {
    const offset = line * BYTES_PER_LINE
    const hexParts: string[] = []
    const asciiParts: string[] = []
    for (let i = 0; i < BYTES_PER_LINE; i++) {
      const idx = offset + i
      if (idx < count) {
        const b = hexBuf[idx]
        hexParts.push(b.toString(16).padStart(2, '0').toUpperCase())
        asciiParts.push(b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')
      } else {
        hexParts.push('  ')
        asciiParts.push(' ')
      }
    }
    const hexStr =
      hexParts.slice(0, 8).join(' ') + '  ' + hexParts.slice(8).join(' ')
    const asciiStr = asciiParts.join('')
    lines.push(
      offset.toString(16).padStart(4, '0').toUpperCase() +
        '  ' +
        hexStr +
        '  ' +
        asciiStr
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-surface p-2 font-mono text-xs text-text-primary leading-5"
    >
      {lines.length === 0 ? (
        <span className="text-text-secondary">Waiting for data...</span>
      ) : (
        <pre className="m-0">{lines.join('\n')}</pre>
      )}
    </div>
  )
}
