import { useScopeStore } from '../store/scopeStore'

export default function HexToggle() {
  const showHex = useScopeStore((s) => s.showHex)
  const setShowHex = useScopeStore((s) => s.setShowHex)

  return (
    <button onClick={() => setShowHex(!showHex)}
      style={{ padding:'4px 10px',fontSize:11,fontWeight:600,borderRadius:4,border:'1px solid #1e3454',background:'transparent',color:'#8899aa',cursor:'pointer' }}>
      {showHex ? 'Wave' : 'HEX'}
    </button>
  )
}
