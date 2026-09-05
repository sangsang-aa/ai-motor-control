// 急停按钮 — inline 红色胶囊(集成到 Composer 发送钮旁),不再 fixed。
// 指令执行改为 motorController.sendCommand。

'use client'

import React, { useState } from 'react'
import { sendCommand } from '@/lib/serial/motorController'

export const EStopButton: React.FC<{ onEStop?: () => void }> = ({ onEStop }) => {
  const [busy, setBusy] = useState(false)
  const handle = async () => {
    if (busy) return
    setBusy(true)
    try {
      await sendCommand('emergency_stop', {})
      onEStop?.()
    } catch (err) {
      console.error('E-Stop failed:', err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={handle}
      disabled={busy}
      title="急停"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
        background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)',
        cursor: 'pointer', transition: 'all 0.15s'
      }}
    >
      <span style={{ fontSize: 13 }}>⏹</span>急停
    </button>
  )
}
