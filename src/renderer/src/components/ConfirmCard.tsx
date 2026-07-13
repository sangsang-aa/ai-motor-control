import React, { useEffect, useState } from 'react'

interface Props {
  toolName: string; arguments: Record<string, unknown>
  onConfirm: () => void; onIgnore: () => void; timeout: number
}

const INFO: Record<string, (a: Record<string, unknown>) => string> = {
  set_speed: (a) => `设置转速: ${String(a.rpm ?? '?')} RPM`,
  set_motor_state: (a) => a.on ? '启动电机' : '停止电机',
  get_status: () => '获取状态'
}

export const ConfirmCard: React.FC<Props> = ({ toolName, arguments: args, onConfirm, onIgnore, timeout }) => {
  const [remaining, setRemaining] = useState(Math.floor(timeout / 1000))
  const [w, setW] = useState(100)
  useEffect(() => {
    const iv = setInterval(() => setRemaining(p => {
      const n = p - 1; setW((n / 30) * 100); if (n <= 0) clearInterval(iv); return n <= 0 ? 0 : n
    }), 1000)
    return () => clearInterval(iv)
  }, [])

  const label = INFO[toolName]?.(args) || `${toolName}(${JSON.stringify(args)})`

  return (
    <div className="flex justify-start mb-3">
      <div className="cfm-card">
        <div className="cfm-body">
          <div className="cfm-title">&#9888; {label}</div>
          <div className="cfm-acts">
            <button onClick={onConfirm} className="cfm-confirm">确认执行</button>
            <button onClick={onIgnore} className="cfm-ignore">忽略</button>
          </div>
          <div className="cfm-timer">
            将在 {remaining} 秒后自动取消
            <div className="h-1 rounded-full mt-1.5 overflow-hidden bg-white/5">
              <div className="h-full rounded-full bg-warning transition-all duration-1000 ease-linear" style={{ width: `${w}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
