'use client'

import React, { useEffect } from 'react'
import { paramEstBus } from '@/lib/bus'
import { useParamEstStore } from '@/lib/stores/paramEstStore'
import ConnectionBar from './ConnectionBar'
import TestControlPanel from './TestControlPanel'
import ConfigPanel from './ConfigPanel'
import EstimatedParamsPanel from './EstimatedParamsPanel'
import DebugScope from './DebugScope'

export const ParamEstApp: React.FC = () => {
  const applyEvent = useParamEstStore((s) => s.applyEvent)

  useEffect(() => {
    const un = paramEstBus.on(applyEvent)
    return () => {
      un()
    }
  }, [applyEvent])

  return (
    <div
      data-ui="codex"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--cx-bg)',
        color: 'var(--cx-text)'
      }}
    >
      <ConnectionBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TestControlPanel />
          <ConfigPanel />
        </div>
        <div
          style={{
            width: 480,
            flexShrink: 0,
            borderLeft: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elev)',
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          <EstimatedParamsPanel />
          <DebugScope />
        </div>
      </div>
    </div>
  )
}

export default ParamEstApp
