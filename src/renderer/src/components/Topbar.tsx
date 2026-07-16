import React from 'react'
import { useMotorStore } from '../store/motorStore'

const BAUD_PRESETS = ['150000','115200','5625000','921600','57600','9600']

export const Topbar: React.FC = () => {
  const { connected, status } = useMotorStore()
  const [port, setPort] = React.useState(status.port || '/dev/ttyUSB0')
  const [baud, setBaud] = React.useState(String(status.baudRate || '150000'))

  const handleToggle = async () => {
    const b = parseInt(baud)
    if (isNaN(b) || b <= 0) { alert('请输入有效的波特率数值'); return }
    if (connected) {
      await window.api.disconnect()
    } else {
      await window.api.connect(port, b)
    }
  }

  return (
    <header className="topbar">
      <img src="./MOTOTUNE.png" alt="" style={{height:28,marginRight:8}} />
      <h1 className="topbar-brand" style={{minWidth:120}}>MOTOTUNE</h1>
      <div className="flex items-center gap-2 ml-6 text-xs">
        <span className={`topbar-indicator ${connected?'on':'off'}`} />
        <span className="text-fg-muted" style={{minWidth:48}}>{connected?'已连接':'未连接'}</span>
        <span className="text-fg-subtle" style={{fontSize:10,minWidth:32}}>端口</span>
        <input value={port} onChange={e=>setPort(e.target.value)} disabled={connected}
          className="input-base text-xs py-1 px-2" style={{width:140,minHeight:26,opacity:connected?0.5:1}} placeholder="/dev/ttyUSB0" />
        <span className="text-fg-subtle" style={{fontSize:10,minWidth:42}}>波特率</span>
        <input value={baud} onChange={e=>setBaud(e.target.value)} disabled={connected}
          className="input-base text-xs py-1 px-2" style={{width:100,minHeight:26,opacity:connected?0.5:1}} placeholder="150000" />
        <button onClick={handleToggle}
          className="px-3 py-1 rounded-lg text-xs font-medium border transition-all"
          style={{background:connected?'rgba(255,59,48,0.15)':'rgba(0,168,255,0.1)',color:connected?'#ff3b30':'#00a8ff',borderColor:connected?'rgba(255,59,48,0.25)':'rgba(0,168,255,0.2)'}}>
          {connected ? '断开' : '连接'}
        </button>
      </div>
      <div className="flex items-center gap-5 ml-auto">
        <div className="topbar-stat"><span>转速</span><span className="v">{status.rpm.toFixed(0)}</span><span className="u">RPM</span></div>
        <div className="topbar-stat"><span>电流</span><span className="v">{status.currentIa.toFixed(2)}</span><span className="u">A</span></div>
        {connected && <span className="text-[10px] text-fg-subtle">{status.baudRate} baud</span>}
      </div>
    </header>
  )
}
