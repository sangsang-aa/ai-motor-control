// 急停按钮 — inline 红色胶囊(集成到 Composer 发送钮旁),不再 fixed。
// 指令执行改为 motorController.sendCommand。

'use client'

import React, { useState } from 'react'
import { sendCommand } from '@/lib/serial/aimotor/controller'

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
      className="cx-btn cx-btn-danger"
    >
      <span style={{ fontSize: 13 }}>⏹</span>急停
    </button>
  )
}
