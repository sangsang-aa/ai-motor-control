'use client'

import React, { useEffect } from 'react'
import { aiMotorBus } from '@/lib/bus'
import { useMotorStore } from '@/lib/stores/motorStore'
import ControlBar from './ControlBar'
import ControlSignals from './ControlSignals'
import ControlWaveforms from './ControlWaveforms'
import SpeedPanel from './SpeedPanel'
import ParamGroups from './ParamGroups'
import RecordingPanel from './RecordingPanel'
import ModelPanel from './ModelPanel'
import ControlLog from './ControlLog'

export const ControlApp: React.FC = () => {
  const applyEvent = useMotorStore((s) => s.applyEvent)

  useEffect(() => {
    const un = aiMotorBus.on(applyEvent)
    return un
  }, [applyEvent])

  return (
    <div data-ui="codex" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--cx-bg)', color: 'var(--cx-text)' }}>
      <ControlBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ParamGroups />
          <SpeedPanel />
        </div>
        <div style={{ width: 560, flexShrink: 0, borderLeft: '1px solid var(--cx-border)', background: 'var(--cx-bg-elev)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ControlSignals />
          <ControlWaveforms />
          <RecordingPanel />
          <ModelPanel />
        </div>
      </div>
      <ControlLog />
    </div>
  )
}

export default ControlApp
