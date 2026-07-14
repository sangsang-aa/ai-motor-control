import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { useMotorStore } from './store/motorStore'

const ALL_CHANNELS = ['Ia', 'Speed', 'Ib', 'Ic', 'Voltage']
const COLORS: Record<string, string> = { Ia: '#ff9500', Speed: '#00a8ff', Ib: '#34c759', Ic: '#ff3b30', Voltage: '#af52de' }
const UNITS: Record<string, string> = { Ia: 'A', Speed: 'RPM', Ib: 'A', Ic: 'A', Voltage: 'V' }
const DEFAULT_RANGES: Record<string, [number, number]> = { Ia: [0, 20], Speed: [0, 6000], Ib: [0, 20], Ic: [0, 20], Voltage: [0, 48] }

// ── Individual chart component (handles init/dispose lifecycle) ──────
const ChartPanel: React.FC<{ ch: string; data: number[]; range: [number, number]; paused: boolean }> = ({ ch, data, range, paused }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts>()

  useEffect(() => {
    if (!containerRef.current) return
    instanceRef.current = echarts.init(containerRef.current, 'dark')
    const onResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', onResize)
    // Initial option
    instanceRef.current.setOption({
      title: { text: `${ch} (${UNITS[ch]})`, textStyle: { color: COLORS[ch] || '#8899aa', fontSize: 12, fontWeight: 600 }, left: 56, top: 6 },
      grid: { left: 56, right: 16, top: 30, bottom: 28 },
      xAxis: { type: 'value', name: 'sample', nameTextStyle: { color: '#556677', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e3454' } }, axisTick: { show: false }, axisLabel: { color: '#556677', fontSize: 9 } },
      yAxis: { type: 'value', name: UNITS[ch], nameTextStyle: { color: '#556677', fontSize: 10 }, min: range[0], max: range[1], splitLine: { lineStyle: { color: '#1e3454' } }, axisLine: { lineStyle: { color: '#1e3454' } }, axisLabel: { color: '#556677', fontSize: 9 } },
      series: [{ type: 'line', data: [] as number[][], smooth: true, showSymbol: false, lineStyle: { color: COLORS[ch] || '#888', width: 1.5 }, areaStyle: { color: `${COLORS[ch]}15` } }]
    })
    return () => { window.removeEventListener('resize', onResize); instanceRef.current?.dispose() }
  }, [])

  // Update data and range
  useEffect(() => {
    if (paused || !instanceRef.current) return
    instanceRef.current.setOption({
      series: [{ data: data.map((v, i) => [i, v]) }],
      yAxis: { min: range[0], max: range[1] }
    })
  }, [data, range, paused])

  return <div ref={containerRef} style={{ flex: 1, minHeight: 150 }} />
}

// ── Main motor window ─────────────────────────────────────────────────
const MotorWindow: React.FC = () => {
  const { rpmHistory, currentHistory, status, connected } = useMotorStore()
  const [selected, setSelected] = useState<string[]>(['Ia', 'Speed'])
  const [paused, setPaused] = useState(false)
  const [ranges, setRanges] = useState<Record<string, [number, number]>>({ ...DEFAULT_RANGES })

  useEffect(() => { const u = window.api.onBackendEvent(e => useMotorStore.getState().applyEvent(e)); return u }, [])

  const toggle = (ch: string) => setSelected(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])

  const getData = (ch: string): number[] => {
    if (ch === 'Speed') return rpmHistory
    if (ch === 'Ia') return currentHistory
    return [] // other channels not wired yet
  }

  const dot = (on: boolean) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 8, background: on ? '#34c759' : '#ff3b30', boxShadow: `0 0 6px ${on ? 'rgba(52,199,89,0.6)' : 'rgba(255,59,48,0.4)'}` })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a1628', color: '#e8ecf1', fontFamily: "'Noto Sans SC',system-ui,sans-serif" }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 44, flexShrink: 0, background: 'linear-gradient(180deg,#152238 0%,#111d32 100%)', borderBottom: '1px solid #1e3454' }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', background: 'linear-gradient(135deg,#00a8ff,#4dc9ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>电机实时监控</span>
        <span style={{ marginLeft: 20, ...dot(connected) }} />
        <span style={{ fontSize: 12, color: '#8899aa' }}>{connected ? '已连接' : '未连接'}</span>
        {connected && <span style={{ marginLeft: 8, fontSize: 11, color: '#556677' }}>{status.port} @ {status.baudRate}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#8899aa' }}>转速 <b style={{ color: '#00a8ff', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>{status.rpm.toFixed(0)}</b> RPM</span>
          <span style={{ fontSize: 12, color: '#8899aa' }}>电流 <b style={{ color: '#ff9500', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>{status.currentIa.toFixed(2)}</b> A</span>
        </div>
      </header>

      {/* Body: charts + right panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Charts area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {selected.map(ch => (
            <ChartPanel key={`${ch}-${selected.length}`} ch={ch} data={getData(ch)} range={ranges[ch] || DEFAULT_RANGES[ch]} paused={paused} />
          ))}
        </div>

        {/* Right control panel */}
        <div style={{ width: 200, flexShrink: 0, borderLeft: '1px solid #1e3454', background: '#111d32', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e3454', fontSize: 11, fontWeight: 600, color: '#00a8ff', letterSpacing: '0.05em' }}>控制面板</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {/* Pause toggle */}
            <button
              onClick={() => setPaused(!paused)}
              style={{ width: '100%', marginBottom: 12, padding: '6px 0', fontSize: 11, fontWeight: 600, borderRadius: 4, border: `1px solid ${paused ? '#00a8ff' : '#1e3454'}`, background: paused ? 'rgba(0,168,255,0.1)' : 'transparent', color: paused ? '#00a8ff' : '#8899aa', cursor: 'pointer' }}
            >
              {paused ? '▶ 继续刷新' : '⏸ 暂停刷新'}
            </button>

            {/* Channel selector */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#556677', marginBottom: 6, letterSpacing: '0.05em' }}>通道选择</div>
            {ALL_CHANNELS.map(ch => (
              <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11, color: selected.includes(ch) ? (COLORS[ch] || '#8899aa') : '#556677', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(ch)} onChange={() => toggle(ch)} style={{ accentColor: COLORS[ch] }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[ch], flexShrink: 0 }} />
                {ch}
              </label>
            ))}

            {/* Axis range controls */}
            {selected.map(ch => (
              <div key={ch} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #1e3454' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: COLORS[ch], marginBottom: 4 }}>{ch} 量程</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={ranges[ch]?.[0] ?? DEFAULT_RANGES[ch][0]}
                    onChange={e => setRanges(prev => ({ ...prev, [ch]: [Number(e.target.value), prev[ch]?.[1] ?? DEFAULT_RANGES[ch][1]] }))}
                    style={{ width: '100%', background: '#0d1f35', border: '1px solid #1e3454', borderRadius: 4, padding: '3px 6px', color: '#e8ecf1', fontSize: 10, outline: 'none' }}
                  />
                  <span style={{ color: '#556677', fontSize: 10 }}>~</span>
                  <input
                    type="number"
                    value={ranges[ch]?.[1] ?? DEFAULT_RANGES[ch][1]}
                    onChange={e => setRanges(prev => ({ ...prev, [ch]: [prev[ch]?.[0] ?? DEFAULT_RANGES[ch][0], Number(e.target.value)] }))}
                    style={{ width: '100%', background: '#0d1f35', border: '1px solid #1e3454', borderRadius: 4, padding: '3px 6px', color: '#e8ecf1', fontSize: 10, outline: 'none' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default MotorWindow
