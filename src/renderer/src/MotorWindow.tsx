import React, { useEffect, useRef, useState, useCallback } from 'react'
import ScopeChart from './components/ScopeChart'
import ChannelPanel from './components/ChannelPanel'
import PauseToggle from './components/PauseToggle'
import HexToggle from './components/HexToggle'
import HexView from './components/HexView'
import { useScopeStore } from './store/scopeStore'
import { useMotorStore } from './store/motorStore'

const MotorWindow: React.FC = () => {
  const { status, connected, applyEvent } = useMotorStore()
  const applyFrame = useScopeStore(s => s.applyFrame)
  const [panelW, setPanelW] = useState(280)
  const showHex = useScopeStore(s => s.showHex)
  const [chartMaxed, setChartMaxed] = useState(false)
  const dragging = useRef(false)

  useEffect(() => {
    return window.api.onBackendEvent(e => {
      applyEvent(e)
      if (e.type === 'telemetry') {
        const seriesIa = e.seriesIa || []
        const seriesRpm = e.seriesRpm || []
        if (seriesIa.length > 0 && seriesRpm.length > 0) {
          const payload: number[] = []
          const len = Math.min(seriesIa.length, seriesRpm.length)
          for (let i = 0; i < len; i++) {
            payload.push(seriesIa[i] || 0, seriesRpm[i] || 0)
          }
          if (payload.length > 0) applyFrame(payload, 2)
        }
      }
    })
  }, [applyEvent, applyFrame])

  useEffect(() => {
    window.api.requestStatus().then(s => {
      if (s.connected) {
        useMotorStore.setState({
          connected: true,
          status: { ...useMotorStore.getState().status, connected: true, port: s.port, baudRate: s.baudRate }
        })
      }
    }).catch(() => {})
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); dragging.current = true
    const sx = e.clientX; const sw = panelW
    const onMove = (ev: MouseEvent) => { if (dragging.current) setPanelW(Math.max(160, Math.min(500, sw + sx - ev.clientX))) }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [panelW])

  useEffect(() => {
    const s = useScopeStore.getState()
    s.setChannelLabel(0, 'Ia (A)'); s.setChannelLabel(1, 'Speed (RPM)')
  }, [])

  const dot = (on: boolean) => ({ display:'inline-block',width:10,height:10,borderRadius:'50%',marginRight:8,background:on?'#34c759':'#ff3b30',boxShadow:`0 0 6px ${on?'rgba(52,199,89,0.6)':'rgba(255,59,48,0.4)'}` })

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',background:'#f7f7f4',color:'#26251e',fontFamily:"'Inter',system-ui,sans-serif" }}>
      <header style={{ display:'flex',alignItems:'center',padding:'0 16px',height:44,flexShrink:0,background:'#fafaf7',borderBottom:'1px solid #e6e5e0',gap:12,WebkitAppRegion:'drag' } as React.CSSProperties}>
        <span style={{ fontSize:13,fontWeight:600,color:'#f54e00',WebkitAppRegion:'no-drag' } as React.CSSProperties}>MOTOTUNE 示波器</span>
        <span style={{ marginLeft:20,...dot(connected),WebkitAppRegion:'no-drag' } as React.CSSProperties} />
        <span style={{ fontSize:12,color:'#807d72',WebkitAppRegion:'no-drag' } as React.CSSProperties}>{connected ? '已连接' : '未连接'}</span>
        {connected && <span style={{ fontSize:11,color:'#a09c92',WebkitAppRegion:'no-drag' } as React.CSSProperties}>{status.port} @ {status.baudRate}</span>}
        <div style={{ marginLeft:'auto',display:'flex',gap:8,alignItems:'center' }}>
          <PauseToggle />
          <HexToggle />
          <span style={{ fontSize:12,color:'#807d72' }}>转速 <b style={{ color:'#f54e00',fontFamily:"'JetBrains Mono',Consolas,monospace" }}>{status.rpm.toFixed(0)}</b> RPM</span>
          <span style={{ fontSize:12,color:'#807d72' }}>电流 <b style={{ color:'#1f8a65',fontFamily:"'JetBrains Mono',Consolas,monospace" }}>{status.currentIa.toFixed(2)}</b> A</span>
        </div>
        <div style={{ marginLeft:'auto',display:'flex',gap:2,WebkitAppRegion:'no-drag' } as React.CSSProperties}>
          <button onClick={() => window.api.chartMinimize()} style={{width:32,height:28,background:'none',border:'none',color:'#807d72',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>–</button>
          <button onClick={async () => { await window.api.chartMaximize(); setChartMaxed(!chartMaxed) }} style={{width:32,height:28,background:'none',border:'none',color:'#807d72',fontSize:chartMaxed?16:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{chartMaxed ? '❐' : '□'}</button>
          <button onClick={() => window.api.chartClose()} style={{width:32,height:28,background:'none',border:'none',color:'#807d72',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
      </header>
      <div style={{ flex:1,display:'flex',minHeight:0 }}>
        <div style={{ flex:1,minWidth:0,overflow:'hidden' }}>
          {showHex ? <HexView /> : <ScopeChart />}
        </div>
        <div onMouseDown={onMouseDown}
          style={{ width:4,cursor:'col-resize',flexShrink:0,transition:'background 0.15s' }}
          ref={el => { if (el) { el.style.background = '#e6e5e0'; el.onmouseenter = () => { el.style.background = '#f54e00' }; el.onmouseleave = () => { el.style.background = '#e6e5e0' } } }} />
        <div style={{ width:panelW,flexShrink:0,borderLeft:'1px solid #e6e5e0',background:'#fafaf7',overflowY:'auto' }}>
          <ChannelPanel />
        </div>
      </div>
    </div>
  )
}
export default MotorWindow
