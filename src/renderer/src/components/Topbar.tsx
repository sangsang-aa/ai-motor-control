import React, { useState } from 'react'
import { useMotorStore } from '../store/motorStore'
const BAUD_OPTS = ['150000','115200','5625000','921600','57600','9600']
export const Topbar: React.FC = () => {
  const { connected, status } = useMotorStore()
  const [port, setPort] = useState(status.port || '/dev/ttyUSB0')
  const [baud, setBaud] = useState(String(status.baudRate || '150000'))
  return (
    <header className="topbar"><h1 className="topbar-brand">AI 电驱控制系统</h1>
      <div className="flex items-center gap-2 ml-6 text-xs">
        <span className={`topbar-indicator ${connected?'on':'off'}`} />
        <span className="text-fg-muted" style={{minWidth:60}}>{connected?'已连接':'未连接'}</span>
        <input value={port} onChange={e=>setPort(e.target.value)} disabled={connected} className="input-base text-xs py-1 px-2" style={{width:130,minHeight:26,opacity:connected?0.5:1}} placeholder="/dev/ttyUSB0" />
        <input value={baud} onChange={e=>setBaud(e.target.value)} disabled={connected} list="baud-list"
          className="input-base text-xs py-1 px-2" style={{width:100,minHeight:26,opacity:connected?0.5:1}} placeholder="150000" />
        <datalist id="baud-list">{BAUD_OPTS.map(b=><option key={b} value={b} />)}</datalist>
        <button onClick={async()=>{const b=parseInt(baud);if(isNaN(b)||b<=0){alert('请输入有效的波特率数值');return};if(connected)await window.api.disconnect();else await window.api.connect(port,b)}} className="px-3 py-1 rounded-lg text-xs font-medium border transition-all" style={{background:connected?'rgba(255,59,48,0.15)':'rgba(0,168,255,0.1)',color:connected?'#ff3b30':'#00a8ff',borderColor:connected?'rgba(255,59,48,0.25)':'rgba(0,168,255,0.2)'}}>{connected?'断开':'连接'}</button>
      </div>
      <div className="flex items-center gap-5 ml-auto">
        <div className="topbar-stat"><span>转速</span><span className="v">{status.rpm.toFixed(0)}</span><span className="u">RPM</span></div>
        <div className="topbar-stat"><span>电流</span><span className="v">{status.currentIa.toFixed(2)}</span><span className="u">A</span></div>
        {connected && <span className="text-[10px] text-fg-subtle">{status.baudRate} baud</span>}
      </div>
    </header>
  )
}
