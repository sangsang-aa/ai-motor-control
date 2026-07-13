import React from 'react'
import { useCommandLock } from '../store/commandLockStore'

export const CommandLockBanner: React.FC = () => {
  const lock = useCommandLock()
  return (
    <div style={{display:'flex',alignItems:'center',padding:'8px 16px',gap:12,fontSize:13,background:'linear-gradient(90deg,rgba(255,149,0,0.15),rgba(255,149,0,0.03))',borderBottom:'1px solid rgba(255,149,0,0.2)',color:'#ffb340'}}>
      <span style={{fontWeight:'bold'}}>!</span>
      <span>{lock.status === 'executing' ? '正在执行电机控制指令，请等待完成...' : '存在待确认的电机控制指令，请先处理'}</span>
    </div>
  )
}
