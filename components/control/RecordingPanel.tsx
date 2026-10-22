'use client'

import React, { useEffect, useRef, useState } from 'react'
import { aiMotorBus } from '@/lib/bus'
import { SAMPLE_NAMES } from '@/lib/serial/aimotor/protocol'

const MAX_ROWS = 100_000

export default function RecordingPanel() {
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const recordingRef = useRef(false)
  const rowsRef = useRef<string[]>([])
  const countRef = useRef(0)

  useEffect(() => {
    const un = aiMotorBus.on((e) => {
      if (e.type !== 'ai_sample' || !recordingRef.current) return
      if (rowsRef.current.length >= MAX_ROWS) {
        recordingRef.current = false
        return
      }
      const s = e.sample
      const row = [s.tick, s.mode, s.stage, s.flags, s.error, ...SAMPLE_NAMES.map((k) => s[k])].join(',')
      rowsRef.current.push(row)
      countRef.current++
      if (countRef.current % 10 === 0) setCount(countRef.current)
    })
    return un
  }, [])

  function start() {
    rowsRef.current = []
    countRef.current = 0
    setCount(0)
    recordingRef.current = true
    setRecording(true)
  }

  function stop() {
    recordingRef.current = false
    setRecording(false)
    setCount(countRef.current)
    if (!rowsRef.current.length) return
    const header = ['tick', 'mode', 'stage', 'flags', 'error', ...SAMPLE_NAMES].join(',')
    const blob = new Blob(['\uFEFF' + header + '\n' + rowsRef.current.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mototune-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">CSV 记录</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {recording ? (
          <button className="cx-btn cx-btn-danger" onClick={stop} data-testid="rec-stop">停止并下载</button>
        ) : (
          <button className="cx-btn cx-btn-primary" onClick={start} data-testid="rec-start">开始记录</button>
        )}
        <span data-testid="rec-count" style={{ fontSize: 12, color: 'var(--cx-muted)' }}>
          已记录 {count} 帧{recording ? ' …' : ''}
        </span>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--cx-subtle)', lineHeight: 1.7 }}>
        记录 100Hz SAMPLE(tick/mode/stage/flags/error + 12 个通道);停止后下载 CSV。上限 10 万行。
      </div>
    </section>
  )
}
