import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { useMotorStore } from './store/motorStore'

const ALL_CHANNELS = ['Ia', 'Speed', 'Ib', 'Ic', 'Voltage']
const CHART_COLORS: Record<string, string> = { Ia: '#ff9500', Speed: '#00a8ff', Ib: '#34c759', Ic: '#ff3b30', Voltage: '#af52de' }

const MotorWindow: React.FC = () => {
  const { rpmHistory, currentHistory, status, connected } = useMotorStore()
  const [selected, setSelected] = useState<string[]>(['Ia', 'Speed'])
  const [paused, setPaused] = useState(false)
  const chartRefs = useRef<Record<string, echarts.ECharts>>({})

  const toggleChannel = (ch: string) => {
    setSelected(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  // Init chart containers
  useEffect(() => {
    const u = window.api.onBackendEvent(e => useMotorStore.getState().applyEvent(e))
    const listeners: (() => void)[] = [u]
    ALL_CHANNELS.forEach(ch => {
      const el = document.getElementById(`chart-${ch}`)
      if (el) {
        const inst = echarts.init(el, 'dark')
        inst.setOption({
          title: { text: `${ch}`, textStyle: { color: '#8899aa', fontSize: 11 }, left: 48, top: 2 },
          grid: { left: 48, right: 12, top: 20, bottom: 12 },
          xAxis: { type: 'value', show: false },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e3454' } }, axisLabel: { color: '#556677', fontSize: 9 } },
          series: [{ type: 'line', data: [] as number[][], smooth: true, showSymbol: false, lineStyle: { color: CHART_COLORS[ch] || '#888', width: 1 }, areaStyle: { color: `${CHART_COLORS[ch]}15` || 'rgba(136,136,136,0.08)' } }]
        })
        chartRefs.current[ch] = inst
        const rh = () => inst.resize()
        window.addEventListener('resize', rh)
        listeners.push(() => window.removeEventListener('resize', rh))
      }
    })
    return () => {
      listeners.forEach(fn => fn())
      Object.values(chartRefs.current).forEach(c => c.dispose())
    }
  }, [])

  // Update data (simple: use rpmHistory for Speed, currentHistory for Ia)
  useEffect(() => {
    if (paused) return
    const speedData = rpmHistory.map((v, i) => [i, v])
    const currentData = currentHistory.map((v, i) => [i, v])
    if (selected.includes('Speed')) chartRefs.current['Speed']?.setOption({ series: [{ data: speedData }] })
    if (selected.includes('Ia')) chartRefs.current['Ia']?.setOption({ series: [{ data: currentData }] })
    // Other channels would come from channels[] in telemetry event
  }, [rpmHistory, currentHistory, paused, selected])

  const dot = (on: boolean) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 8, background: on ? '#34c759' : '#ff3b30', boxShadow: `0 0 6px ${on ? 'rgba(52,199,89,0.6)' : 'rgba(255,59,48,0.4)'}` })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a1628', color: '#e8ecf1', fontFamily: "'Noto Sans SC',system-ui,sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 44, flexShrink: 0, background: 'linear-gradient(180deg,#152238 0%,#111d32 100%)', borderBottom: '1px solid #1e3454', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', background: 'linear-gradient(135deg,#00a8ff,#4dc9ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>电机实时监控</span>
        <span style={dot(connected)} /><span style={{ fontSize: 12, color: '#8899aa' }}>{connected ? '已连接' : '未连接'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#556677' }}>通道:</span>
          {ALL_CHANNELS.map(ch => (
            <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: selected.includes(ch) ? (CHART_COLORS[ch] || '#8899aa') : '#556677', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.includes(ch)} onChange={() => toggleChannel(ch)} style={{ accentColor: CHART_COLORS[ch] }} />
              {ch}
            </label>
          ))}
          <button onClick={() => setPaused(!paused)} style={{ marginLeft: 16, padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4, border: `1px solid ${paused ? '#00a8ff' : '#1e3454'}`, background: paused ? 'rgba(0,168,255,0.1)' : 'transparent', color: paused ? '#00a8ff' : '#8899aa', cursor: 'pointer' }}>
            {paused ? '▶ 继续' : '⏸ 暂停'}
          </button>
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {selected.map(ch => (
          <div key={ch} id={`chart-${ch}`} style={{ height: selected.length <= 2 ? '50%' : '33%', minHeight: 150, flexShrink: 0 }} />
        ))}
      </div>
    </div>
  )
}
export default MotorWindow
