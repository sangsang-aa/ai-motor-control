import React from 'react'
import { useMotorStore } from '../store/motorStore'

export const DisconnectBanner: React.FC = () => {
  const { disconnectMessage, connected } = useMotorStore()
  if (!disconnectMessage || connected) return null
  return (
    <div className="dc-banner">
      <span style={{fontWeight:'bold',fontSize:16}}>!</span>
      <span>抱歉，没有检测到设备，请检查设备的连接情况！</span>
      <span className="dismiss" onClick={() => useMotorStore.setState({ disconnectMessage: false })}>关闭</span>
    </div>
  )
}
