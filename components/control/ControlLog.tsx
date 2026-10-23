'use client'

import React, { useEffect, useState } from 'react'
import { aiMotorBus } from '@/lib/bus'

interface LogItem {
  id: number
  text: string
}

let seq = 0

export default function ControlLog() {
  const [items, setItems] = useState<LogItem[]>([])

  useEffect(() => {
    const push = (text: string) => {
      setItems((prev) => [...prev.slice(-49), { id: ++seq, text }])
    }
    const un = aiMotorBus.on((e) => {
      if (e.type === 'ai_executed') push(`${e.action}: ${e.result}`)
      else if (e.type === 'ai_error') push(`错误: ${e.message}`)
      else if (e.type === 'ai_status') push(e.connected ? `已连接 ${e.port}` : '未连接')
      else if (e.type === 'ai_closed') push('连接已关闭')
    })
    return un
  }, [])

  return (
    <section className="cx-panel" style={{ margin: '0 16px 12px', padding: '8px 12px', flexShrink: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--cx-subtle)', marginBottom: 4 }}>操作日志</div>
      <div
        data-testid="control-log"
        style={{ height: 72, overflowY: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--cx-muted)', lineHeight: 1.7 }}
      >
        {items.length === 0 ? '—' : items.map((i) => <div key={i.id}>{i.text}</div>)}
      </div>
    </section>
  )
}
