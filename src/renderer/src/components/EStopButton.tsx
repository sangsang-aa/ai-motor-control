import React from 'react'

export const EStopButton: React.FC = () => {
  const handleEStop = async () => {
    try {
      await window.api.sendCommand('set_motor_state', { on: false })
      await window.api.sendCommand('set_speed', { rpm: 0 })
    } catch (err) { console.error('E-Stop failed:', err) }
  }
  return <button onClick={handleEStop} className="estop-btn">急停</button>
}
