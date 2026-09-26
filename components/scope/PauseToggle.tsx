'use client'
import { useScopeStore } from '@/lib/stores/scopeStore'

export default function PauseToggle() {
  const paused = useScopeStore((s) => s.paused)
  const setPaused = useScopeStore((s) => s.setPaused)
  return (
    <button onClick={() => setPaused(!paused)}
      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${paused ? 'var(--cx-border-2)' : 'var(--cx-border)'}`, background: paused ? 'var(--cx-surface-2)' : 'transparent', color: paused ? 'var(--cx-text)' : 'var(--cx-muted)', cursor: 'pointer' }}>
      {paused ? '\u25B6 \u7EE7\u7EED' : '\u23F8 \u6682\u505C'}
    </button>
  )
}
