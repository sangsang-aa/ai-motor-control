'use client'

import React from 'react'
import { useParamEstStore } from '@/lib/stores/paramEstStore'
import { sendControl, startAcquisition } from '@/lib/serial/paramEstController'
import { PM_TEST_LABEL, type PmTestId } from '@/lib/types'

const TESTS: PmTestId[] = [0, 1, 2, 3, 4]

export default function TestControlPanel() {
  const connected = useParamEstStore((s) => s.connected)
  const control = useParamEstStore((s) => s.control)
  const acquiring = useParamEstStore((s) => s.acquiring)
  const setControl = useParamEstStore((s) => s.setControl)
  const setTest = useParamEstStore((s) => s.setTest)
  const beginAcquisition = useParamEstStore((s) => s.beginAcquisition)

  async function onStart() {
    const w = { ...useParamEstStore.getState().control, enable: true }
    setControl({ enable: true })
    startAcquisition()
    beginAcquisition()
    await sendControl(w)
  }

  async function onStop() {
    const w = { ...useParamEstStore.getState().control, enable: false }
    setControl({ enable: false })
    await sendControl(w)
  }

  const seg = (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12.5,
    cursor: 'pointer',
    border: '1px solid ' + (active ? 'var(--cx-border-2)' : 'transparent'),
    background: active ? 'var(--cx-surface-2)' : 'transparent',
    color: active ? 'var(--cx-text)' : 'var(--cx-muted)'
  })

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title">测试控制</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--cx-muted)' }}>测试方法</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <span data-testid="method-manual" style={seg(!control.auto)} onClick={() => setControl({ auto: false })}>
              手动
            </span>
            <span data-testid="method-auto" style={seg(control.auto)} onClick={() => setControl({ auto: true })}>
              自动
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--cx-muted)' }}>选择测试</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TESTS.map((t) => (
              <span key={t} data-testid={`test-${t}`} style={seg(control.test === t)} onClick={() => setTest(t)}>
                {PM_TEST_LABEL[t]}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="cx-btn cx-btn-primary" onClick={onStart} disabled={!connected || acquiring} data-testid="btn-start">
            开始采集
          </button>
          <button className="cx-btn cx-btn-danger" onClick={onStop} disabled={!connected} data-testid="btn-stop">
            停止
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--cx-subtle)' }}>
        当前测试：{PM_TEST_LABEL[control.test]} · {control.auto ? '自动' : '手动'} · {control.enable ? '已启动' : '未启动'}
      </div>
    </section>
  )
}
