import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { useMotorStore } from './store/motorStore'

const BASE = {
  textStyle: { color: '#8899aa' }, grid: { left: 52, right: 16, top: 28, bottom: 20 },
  xAxis: { type: 'value' as const, show: false },
  yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#1e3454' } }, axisLabel: { color: '#556677', fontSize: 10 } },
  series: [{ type: 'line' as const, data: [] as number[][], smooth: true, showSymbol: false, areaStyle: {} }]
}

const MotorWindow: React.FC = () => {
  const { rpmHistory, currentHistory, status, connected } = useMotorStore()
  const [paused, setPaused] = useState(false)
  const sr = useRef<HTMLDivElement>(null); const cr = useRef<HTMLDivElement>(null)
  const sc = useRef<echarts.ECharts>(); const cc = useRef<echarts.ECharts>()

  useEffect(() => { const u = window.api.onBackendEvent(e => useMotorStore.getState().applyEvent(e)); return u }, [])

  useEffect(() => {
    if (sr.current) { sc.current = echarts.init(sr.current, 'dark'); sc.current.setOption({ ...BASE, title: { text: '转速 (RPM)', textStyle: { color: '#8899aa', fontSize: 12 }, left: 52, top: 4 }, yAxis: { ...BASE.yAxis, min: 0, max: 6000 }, series: [{ ...BASE.series[0], lineStyle: { color: '#00a8ff', width: 1.5 }, areaStyle: { color: 'rgba(0,168,255,0.08)' } }] }) }
    if (cr.current) { cc.current = echarts.init(cr.current, 'dark'); cc.current.setOption({ ...BASE, title: { text: '相电流 Ia (A)', textStyle: { color: '#8899aa', fontSize: 12 }, left: 52, top: 4 }, series: [{ ...BASE.series[0], lineStyle: { color: '#ff9500', width: 1.5 }, areaStyle: { color: 'rgba(255,149,0,0.08)' } }] }) }
    const rh = () => { sc.current?.resize(); cc.current?.resize() }
    window.addEventListener('resize', rh)
    return () => { window.removeEventListener('resize', rh); sc.current?.dispose(); cc.current?.dispose() }
  }, [])

  useEffect(() => { if (paused) return; sc.current?.setOption({ series: [{ data: rpmHistory.map((v, i) => [i, v]) }] }); cc.current?.setOption({ series: [{ data: currentHistory.map((v, i) => [i, v]) }] }) }, [rpmHistory, currentHistory, paused])

  const dot = (on: boolean) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 8, background: on ? '#34c759' : '#ff3b30', boxShadow: `0 0 6px ${on ? 'rgba(52,199,89,0.6)' : 'rgba(255,59,48,0.4)'}` })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a1628', color: '#e8ecf1', fontFamily: "'Noto Sans SC',system-ui,sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 48, flexShrink: 0, background: 'linear-gradient(180deg,#152238 0%,#111d32 100%)', borderBottom: '1px solid #1e3454', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', background: 'linear-gradient(135deg,#00a8ff,#4dc9ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>电机实时监控</span>
        <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={dot(connected)} /><span style={{ color: '#8899aa' }}>{connected ? '已连接' : '未连接'}</span>
          {connected && <span style={{ color: '#556677', fontSize: 11 }}>{status.port}</span>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <button onClick={() => setPaused(!paused)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4, border: `1px solid ${paused?'#00a8ff':'#1e3454'}`, background: paused?'rgba(0,168,255,0.1)':'transparent', color: paused?'#00a8ff':'#8899aa', cursor: 'pointer' }}>
            {paused ? '▶ 继续刷新' : '⏸ 暂停刷新'}
          </button>
        </div>
      </header>
      <div ref={sr} style={{ flex: 1, minHeight: 0 }} />
      <div ref={cr} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
export default MotorWindow
