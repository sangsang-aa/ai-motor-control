import React from 'react'

export const EStopButton: React.FC<{ onEStop?: () => void }> = ({ onEStop }) => {
  const handle = async () => {
    try { await window.api.sendCommand('set_motor_state', { on: false }); await window.api.sendCommand('set_speed', { rpm: 0 }); onEStop?.() }
    catch (err) { console.error('E-Stop failed:', err) }
  }
  return <button onClick={handle} className="estop-btn">急停</button>
}
