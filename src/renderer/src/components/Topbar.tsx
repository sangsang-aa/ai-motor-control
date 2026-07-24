import React from 'react'
import { useMotorStore } from '../store/motorStore'

export const Topbar: React.FC = () => {
  const { connected, status } = useMotorStore()
  const [port, setPort] = React.useState(status.port || '/dev/ttyUSB0')
  const [baud, setBaud] = React.useState(String(status.baudRate || '150000'))

  const handleToggle = async () => {
    const b = parseInt(baud)
    if (isNaN(b) || b <= 0) { alert('请输入有效的波特率数值'); return }
    if (connected) { await window.api.disconnect() } else { await window.api.connect(port, b) }
  }

  return (
    <header className="topbar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span className="topbar-brand" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>MOTOTUNE</span>
      <div className="flex items-center gap-2 ml-6 text-xs" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className={`topbar-indicator ${connected?'on':'off'}`} />
        <span style={{minWidth:48,color:'#5a5852'}}>{connected?'已连接':'未连接'}</span>
        <span style={{fontSize:11,color:'#a09c92',minWidth:28}}>端口</span>
        <input value={port} onChange={e=>setPort(e.target.value)} disabled={connected}
          className="input-base text-xs py-1 px-2" style={{width:140,minHeight:26}} placeholder="/dev/ttyUSB0" />
        <span style={{fontSize:11,color:'#a09c92',minWidth:42}}>波特率</span>
        <input value={baud} onChange={e=>setBaud(e.target.value)} disabled={connected}
          className="input-base text-xs py-1 px-2" style={{width:100,minHeight:26}} placeholder="150000" />
        <button onClick={handleToggle}
          className="px-3 py-1 rounded-lg text-xs font-medium border transition-all"
          style={{background:connected?'#fef2f2':'#fff',color:connected?'#cf2d56':'#f54e00',borderColor:connected?'#fecaca':'#e6e5e0'}}>
          {connected ? '断开' : '连接'}
        </button>
      </div>
      <div className="flex items-center gap-5 ml-auto" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="topbar-stat"><span style={{color:'#807d72'}}>转速</span><span className="v">{status.rpm.toFixed(0)}</span><span className="u">RPM</span></div>
        <div className="topbar-stat"><span style={{color:'#807d72'}}>电流</span><span className="v">{status.currentIa.toFixed(2)}</span><span className="u">A</span></div>
        {connected && <span style={{fontSize:11,color:'#a09c92'}}>{status.baudRate} baud</span>}
        <div style={{ display:'flex',gap:2,marginLeft:16,WebkitAppRegion:'no-drag' } as React.CSSProperties}>
          <button onClick={() => window.api.winMinimize()} style={{width:32,height:28,background:'none',border:'none',color:'#807d72',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>–</button>
          <button onClick={() => window.api.winMaximize()} style={{width:32,height:28,background:'none',border:'none',color:'#807d72',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>□</button>
          <button onClick={() => window.api.winClose()} style={{width:32,height:28,background:'none',border:'none',color:'#807d72',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
      </div>
    </header>
  )
}
