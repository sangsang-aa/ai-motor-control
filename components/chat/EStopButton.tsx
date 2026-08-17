// 急停按钮 — 从 Electron 版迁移;指令执行改为 motorController.sendCommand

'use client'

import React from 'react'
import { sendCommand } from '@/lib/serial/motorController'

export const EStopButton: React.FC<{ onEStop?: () => void }> = ({ onEStop }) => {
  const handle = async () => {
    try {
      await sendCommand('set_motor_state', { on: false })
      await sendCommand('set_speed', { rpm: 0 })
      onEStop?.()
    } catch (err) {
      console.error('E-Stop failed:', err)
    }
  }
  return <button onClick={handle} className="estop-btn">急停</button>
}
