import React, { useState } from 'react'
import { useMotorStore } from '../store/motorStore'
export const SerialControlBar: React.FC<{ locked?: boolean }> = ({ locked }) => {
  const { connected } = useMotorStore()
  const [port, setPort] = useState('/dev/ttyUSB0'); const [baud, setBaud] = useState('150000')
  return (
    <div className="flex items-center gap-2 text-xs">
      <input value={port} onChange={e=>setPort(e.target.value)} disabled={connected||locked} className="input-base text-xs py-1 px-2" style={{width:130,minHeight:26}} placeholder="/dev/ttyUSB0" />
      <input value={baud} onChange={e=>setBaud(e.target.value)} disabled={connected||locked} className="input-base text-xs py-1 px-2" style={{width:100,minHeight:26}} placeholder="150000" list="baud-list2" />
      <datalist id="baud-list2">{['150000','115200','5625000','921600','57600','9600'].map(b=><option key={b} value={b} />)}</datalist>
      <button onClick={async()=>{if(connected)await window.api.disconnect();else await window.api.connect(port,parseInt(baud))}} disabled={locked}
        className="px-3 py-1 rounded-lg text-xs font-medium border transition-all"
        style={{background:connected?'rgba(255,59,48,0.15)':'rgba(0,168,255,0.1)',color:connected?'#ff3b30':'#00a8ff',borderColor:connected?'rgba(255,59,48,0.25)':'rgba(0,168,255,0.2)'}}>{connected?'断开':'连接'}</button>
    </div>
  )
}
