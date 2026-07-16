import React, { useEffect, useRef, useState, useCallback } from 'react'
import ScopeChart from './components/ScopeChart'
import ChannelPanel from './components/ChannelPanel'
import { useScopeStore } from './store/scopeStore'
import { useMotorStore } from './store/motorStore'

const MotorWindow: React.FC = () => {
  const { rpmHistory, currentHistory, status, connected } = useMotorStore()
  const applyFrame = useScopeStore(s => s.applyFrame)
  const lastFedLen = useRef(0)
  const [panelW, setPanelW] = useState(280)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = panelW
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPanelW(Math.max(160, Math.min(500, startW + startX - ev.clientX)))
    }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelW])

  // Feed motorStore data into scopeStore as interleaved [Ia, Speed]
  useEffect(() => {
    const len = Math.min(rpmHistory.length, currentHistory.length)
    if (len <= lastFedLen.current) return
    const newSamples = len - lastFedLen.current
    const payload: number[] = []
    for (let i = lastFedLen.current; i < len; i++) {
      payload.push(currentHistory[i] || 0, rpmHistory[i] || 0)
    }
    if (payload.length > 0) {
      applyFrame(payload, 2)
    }
    lastFedLen.current = len
  }, [rpmHistory.length, currentHistory.length])

  // Set channel labels once
  useEffect(() => {
    const store = useScopeStore.getState()
    store.setChannelLabel(0, 'Ia (A)')
    store.setChannelLabel(1, 'Speed (RPM)')
  }, [])

  const dot = (on: boolean) => ({ display:'inline-block',width:10,height:10,borderRadius:'50%',marginRight:8,background:on?'#34c759':'#ff3b30',boxShadow:`0 0 6px ${on?'rgba(52,199,89,0.6)':'rgba(255,59,48,0.4)'}` })

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',background:'#0a1628',color:'#e8ecf1',fontFamily:"'Noto Sans SC',system-ui,sans-serif" }}>
      <header style={{ display:'flex',alignItems:'center',padding:'0 16px',height:44,flexShrink:0,background:'linear-gradient(180deg,#152238 0%,#111d32 100%)',borderBottom:'1px solid #1e3454' }}>
        <span style={{ fontSize:13,fontWeight:700,letterSpacing:'0.05em',background:'linear-gradient(135deg,#00a8ff,#4dc9ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>电机实时监控</span>
        <span style={{ marginLeft:20,...dot(connected) }} />
        <span style={{ fontSize:12,color:'#8899aa' }}>{connected ? '已连接' : '未连接'}</span>
        {connected && <span style={{ marginLeft:8,fontSize:11,color:'#556677' }}>{status.port} @ {status.baudRate}</span>}
        <div style={{ marginLeft:'auto',display:'flex',gap:8 }}>
          <span style={{ fontSize:12,color:'#8899aa' }}>转速 <b style={{ color:'#00a8ff',fontFamily:"'JetBrains Mono',Consolas,monospace" }}>{status.rpm.toFixed(0)}</b> RPM</span>
          <span style={{ fontSize:12,color:'#8899aa' }}>电流 <b style={{ color:'#ff9500',fontFamily:"'JetBrains Mono',Consolas,monospace" }}>{status.currentIa.toFixed(2)}</b> A</span>
        </div>
      </header>
      <div style={{ flex:1,display:'flex',minHeight:0 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <ScopeChart />
        </div>
        <div
          onMouseDown={onMouseDown}
          style={{ width:4,cursor:'col-resize',background:dragging.current?'#00a8ff':'#1e3454',flexShrink:0,transition:dragging.current?'none':'background 0.15s' }}
        />
        <div style={{ width:panelW,flexShrink:0,borderLeft:'1px solid #1e3454',background:'#111d32',overflowY:'auto' }}>
          <ChannelPanel />
        </div>
      </div>
    </div>
  )
}
export default MotorWindow
