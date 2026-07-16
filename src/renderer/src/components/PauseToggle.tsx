import { useScopeStore } from '../store/scopeStore'

export default function PauseToggle() {
  const paused = useScopeStore((s) => s.paused)
  const setPaused = useScopeStore((s) => s.setPaused)

  return (
    <button onClick={() => setPaused(!paused)}
      style={{ padding:'4px 10px',fontSize:11,fontWeight:600,borderRadius:4,border:`1px solid ${paused?'#00a8ff':'#1e3454'}`,background:paused?'rgba(0,168,255,0.1)':'transparent',color:paused?'#00a8ff':'#8899aa',cursor:'pointer' }}>
      {paused ? '\u25B6 \u7EE7\u7EED' : '\u23F8 \u6682\u505C'}
    </button>
  )
}
