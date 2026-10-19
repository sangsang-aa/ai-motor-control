'use client'

import React from 'react'
import { CONFIG_PARAMS, CONFIG_PARAM_LABEL } from '@/lib/config'
import { useParamEstStore } from '@/lib/stores/paramEstStore'
import { sendParam } from '@/lib/serial/paramEstController'

export default function ConfigPanel() {
  const connected = useParamEstStore((s) => s.connected)
  const config = useParamEstStore((s) => s.config)
  const setConfigValue = useParamEstStore((s) => s.setConfigValue)

  async function sendAll() {
    const cfg = useParamEstStore.getState().config
    for (let i = 0; i < CONFIG_PARAMS.length; i++) {
      await sendParam(i + 1, cfg[CONFIG_PARAMS[i]] ?? 0)
    }
  }

  return (
    <section className="cx-panel" style={{ padding: 16 }}>
      <div className="cx-panel-title" style={{ display: 'flex', alignItems: 'center' }}>
        配置器参数（命令 1..21）
        <button
          className="cx-btn cx-btn-ghost"
          style={{ marginLeft: 'auto', fontWeight: 400 }}
          onClick={sendAll}
          disabled={!connected}
          data-testid="cfg-send"
        >
          下发全部配置
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {CONFIG_PARAMS.map((name, i) => (
          <label key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
              #{i + 1} {name} · {CONFIG_PARAM_LABEL[name]}
            </span>
            <input
              className="input-base"
              type="number"
              value={String(config[name] ?? 0)}
              onChange={(e) => setConfigValue(name, Number(e.target.value))}
              data-testid={`cfg-${name}`}
            />
          </label>
        ))}
      </div>
    </section>
  )
}
