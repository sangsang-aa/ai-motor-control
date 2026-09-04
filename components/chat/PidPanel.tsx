'use client'

import React, { useState } from 'react'
import { sendCommand } from '@/lib/serial/motorController'
import { useMotorStore } from '@/lib/stores/motorStore'

interface PidField {
  key: string
  label: string
}

const GROUP_DEFS: { name: string; title: string; fields: PidField[] }[] = [
  {
    name: 'SPD',
    title: '速度环 (SPD)',
    fields: [
      { key: 'PID_SPD_KP', label: 'Kp 比例' },
      { key: 'PID_SPD_KI', label: 'Ki 积分' },
      { key: 'PID_SPD_KD', label: 'Kd 微分' },
      { key: 'PID_SPD_KD_N', label: 'Kd_N 微分滤波' },
      { key: 'PID_SPD_KI_UPLIM', label: '抗饱和积分上限' },
      { key: 'PID_SPD_KI_LOWLIM', label: '抗饱和积分下限' },
      { key: 'PID_SPD_KI_OUT_LIM', label: '积分限幅' },
      { key: 'PID_SPD_OUT_LIM', label: '输出限幅' }
    ]
  },
  {
    name: 'CUR',
    title: '电流环 (CUR)',
    fields: [
      { key: 'PID_CUR_KP', label: 'Kp 比例' },
      { key: 'PID_CUR_KI', label: 'Ki 积分' },
      { key: 'PID_CUR_KD', label: 'Kd 微分' },
      { key: 'PID_CUR_KD_N', label: 'Kd_N 微分滤波' },
      { key: 'PID_CUR_KI_UPLIM', label: '抗饱和积分上限' },
      { key: 'PID_CUR_KI_LOWLIM', label: '抗饱和积分下限' },
      { key: 'PID_CUR_KI_OUT_LIM', label: '积分限幅' },
      { key: 'PID_CUR_OUT_LIM', label: '输出限幅' }
    ]
  }
]

const fieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0'
}

export const PidPanel: React.FC = () => {
  const [values, setValues] = useState<Record<string, string>>({})
  const connected = useMotorStore((s) => s.connected)
  const [busy, setBusy] = useState(false)

  const setValue = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  const writeOne = async (key: string) => {
    const v = parseFloat(values[key] ?? '')
    if (!Number.isFinite(v)) {
      alert('请输入有效数字')
      return
    }
    setBusy(true)
    try {
      await sendCommand(`write_pid_${key}`, { value: v })
    } catch (e) {
      alert(`写入失败: ${e}`)
    } finally {
      setBusy(false)
    }
  }

  const writeGroup = async (fields: PidField[]) => {
    const vals: number[] = []
    for (const f of fields) {
      const v = parseFloat(values[f.key] ?? '')
      if (!Number.isFinite(v)) {
        alert(`${f.label} 请输入有效数字`)
        return
      }
      vals.push(v)
    }
    setBusy(true)
    try {
      for (let i = 0; i < fields.length; i++) {
        await sendCommand(`write_pid_${fields[i].key}`, { value: vals[i] })
      }
      alert(`已写入 ${fields[0].key.startsWith('PID_SPD') ? '速度环' : '电流环'}参数`)
    } catch (e) {
      alert(`写入失败: ${e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {GROUP_DEFS.map((g) => (
        <div key={g.name} style={{ flex: 1, minWidth: 260, background: '#121e33', border: '1px solid #1e3454', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00a8ff', marginBottom: 8 }}>{g.title}</div>
          {g.fields.map((f) => (
            <div key={f.key} style={fieldStyle}>
              <span style={{ fontSize: 11, color: '#8899aa', width: 120, flexShrink: 0 }}>{f.label}</span>
              <input
                value={values[f.key] ?? ''}
                onChange={(e) => setValue(f.key, e.target.value)}
                placeholder="float"
                className="input-base text-xs py-1 px-2"
                style={{ flex: 1, minWidth: 0, minHeight: 26 }}
              />
              <button
                onClick={() => writeOne(f.key)}
                disabled={!connected || busy}
                className="btn-ghost text-xs shrink-0"
                style={{ padding: '4px 8px', background: 'rgba(0,168,255,0.08)', color: connected ? '#00a8ff' : '#556677' }}
              >
                写
              </button>
            </div>
          ))}
          <button
            onClick={() => writeGroup(g.fields)}
            disabled={!connected || busy}
            className="btn-primary text-xs w-full mt-2"
            style={{ padding: 6 }}
          >
            写入整组 {g.name}
          </button>
        </div>
      ))}
    </div>
  )
}
