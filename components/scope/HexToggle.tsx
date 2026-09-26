'use client'
import { useScopeStore } from '@/lib/stores/scopeStore'

export default function HexToggle() {
  const showHex = useScopeStore((s) => s.showHex)
  const setShowHex = useScopeStore((s) => s.setShowHex)
  return (
    <button onClick={() => setShowHex(!showHex)}
      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid var(--cx-border)', background: 'transparent', color: 'var(--cx-muted)', cursor: 'pointer' }}>
      {showHex ? 'Wave' : 'HEX'}
    </button>
  )
}
