// 示波器主界面 — Altior 近黑风格:顶部条(返回/状态/控制) + 波形区 + 通道面板。

'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import ScopeChart from './ScopeChart'
import ChannelPanel from './ChannelPanel'
import PauseToggle from './PauseToggle'
import HexToggle from './HexToggle'
import HexView from './HexView'
import { useScopeStore, autoColor } from '@/lib/stores/scopeStore'
import { useMotorStore } from '@/lib/stores/motorStore'
import { backendBus, hexBus } from '@/lib/bus'
import { useLangStore, t } from '@/lib/i18n'

export const ScopeApp: React.FC = () => {
  const lang = useLangStore((s) => s.lang)
  const { status, connected, applyEvent } = useMotorStore()
  const appendHex = useScopeStore((s) => s.appendHex)
  const [panelW, setPanelW] = useState(280)
  const showHex = useScopeStore((s) => s.showHex)
  const channels = useScopeStore((s) => s.channels)
  const buffers = useScopeStore((s) => s.buffers)
  const n = useScopeStore((s) => s.n)
  const waveBatch = useScopeStore((s) => s.waveBatch)
  const dragging = useRef(false)
  const latestCurrent = waveBatch === null
    ? status.currentIa
    : buffers[0]?.[n - 1] ?? status.currentIa

  useEffect(() => {
    const u1 = backendBus.on(applyEvent)
    const u2 = hexBus.on((bytes) => appendHex(bytes))
    return () => { u1(); u2() }
  }, [applyEvent, appendHex])

  useEffect(() => {
    const s = useScopeStore.getState()
    s.setChannelLabel(0, 'Ia (A)')
    s.setChannelLabel(1, 'Speed (RPM)')
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const sx = e.clientX
    const sw = panelW
    const onMove = (ev: MouseEvent) => { if (dragging.current) setPanelW(Math.max(160, Math.min(500, sw + sx - ev.clientX))) }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelW])

  const dot = (on: boolean) => ({
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 5,
    background: on ? '#2bb8a8' : '#4a4a4a', boxShadow: `0 0 6px ${on ? 'rgba(43,184,168,0.6)' : 'none'}`
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d0d', color: '#ececec', fontFamily: "'Noto Sans SC',system-ui,sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 46, flexShrink: 0, borderBottom: '1px solid #2a2a2a', gap: 12 }}>
        <Link href="/" style={{ fontSize: 12, color: '#2bb8a8', textDecoration: 'none', border: '1px solid rgba(43,184,168,0.3)', padding: '3px 10px', borderRadius: 4 }}>← 返回聊天</Link>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', color: '#ececec' }}>{t(lang, 'scope')}</span>
        <span style={dot(connected)} />
        <span style={{ fontSize: 12, color: '#9aa0a6' }}>{connected ? t(lang, 'connected') : t(lang, 'disconnected')}</span>
        {connected && <span style={{ fontSize: 11, color: '#6b7075' }}>{status.port} @ {status.baudRate}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <PauseToggle />
          <HexToggle />
        </div>
      </header>
      <div className="scope-workspace" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div className="scope-plot-area" style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '8px 14px', borderBottom: '1px solid #2a2a2a', flexShrink: 0, background: '#111111' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ececec', marginRight: 4 }}>{t(lang, 'realtime')}</span>
            <span data-testid="realtime-current" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9aa0a6' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: channels[0]?.colorOverride || autoColor(0) }} />
              <span>Ia</span>
              <b style={{ color: '#ececec', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>{latestCurrent.toFixed(3)}</b>
              <span style={{ fontSize: 10, color: '#6b7075' }}>A</span>
            </span>
            <span data-testid="realtime-speed" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9aa0a6' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: channels[1]?.colorOverride || autoColor(1) }} />
              <span>Speed</span>
              <b style={{ color: '#ececec', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>{status.rpm.toFixed(0)}</b>
              <span style={{ fontSize: 10, color: '#6b7075' }}>RPM</span>
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {showHex ? <HexView /> : <ScopeChart />}
          </div>
        </div>
        <div className="scope-resizer" onMouseDown={onMouseDown}
          style={{ width: 4, cursor: 'col-resize', flexShrink: 0, transition: 'background 0.15s' }}
          ref={(el) => {
            if (el) {
              el.style.background = '#2a2a2a'
              el.onmouseenter = () => { el.style.background = '#2bb8a8' }
              el.onmouseleave = () => { el.style.background = '#2a2a2a' }
            }
          }} />
        <div className="scope-channel-panel" style={{ width: panelW, flexShrink: 0, borderLeft: '1px solid #2a2a2a', background: '#121212', overflowY: 'auto' }}>
          <ChannelPanel />
        </div>
      </div>
    </div>
  )
}
