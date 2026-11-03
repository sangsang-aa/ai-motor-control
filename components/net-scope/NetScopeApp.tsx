'use client'

import React from 'react'
import Link from 'next/link'
import { useLangStore, t } from '@/lib/i18n'
import { toLongCsv, downloadText } from '@/lib/tekhsi/csv'
import { useTekHsi } from './useTekHsi'
import NetScopeChart from './NetScopeChart'
import NetScopeMeta from './NetScopeMeta'

function dot(on: boolean) {
  return {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 5,
    background: on ? 'var(--cx-success)' : 'var(--cx-subtle)'
  } as React.CSSProperties
}

export default function NetScopeApp() {
  const lang = useLangStore((s) => s.lang)
  const {
    host,
    port,
    status,
    channels,
    selected,
    result,
    error,
    busy,
    continuous,
    setHost,
    setPort,
    setSelected,
    setContinuous,
    setForceSequence,
    connect,
    disconnect,
    acquire
  } = useTekHsi()

  const connected = status.connected

  const toggleChannel = (name: string) => {
    setSelected(
      selected.includes(name)
        ? selected.filter((x) => x !== name)
        : [...selected, name]
    )
  }

  const exportCsv = () => {
    if (!result?.channels.length) return
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadText(`tekhsi-${stamp}.csv`, toLongCsv(result.channels))
  }

  const version = status.protocolVersion ? (status.protocolVersion / 100).toFixed(1) : null

  return (
    <div
      data-ui="codex"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--cx-bg)',
        color: 'var(--cx-text)',
        fontFamily: "'Noto Sans SC',system-ui,sans-serif"
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          height: 44,
          flexShrink: 0,
          borderBottom: '1px solid var(--cx-border)',
          gap: 12
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: 12,
            color: 'var(--cx-text)',
            textDecoration: 'none',
            border: '1px solid var(--cx-border-2)',
            padding: '3px 10px',
            borderRadius: 6
          }}
        >
          ← 返回聊天
        </Link>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>
          {t(lang, 'netScope')}
        </span>
        <span style={dot(connected)} />
        <span data-testid="net-status" style={{ fontSize: 12, color: 'var(--cx-muted)' }}>
          {connected
            ? `已连接 ${status.host}:${status.port}`
            : t(lang, 'disconnected')}
        </span>
        {connected && version && (
          <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>
            TekHSI v{version} · {channels.length} 通道
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--cx-subtle)' }}>
          明文 gRPC · 端口 {port || 5000}
        </span>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside
          style={{
            width: 310,
            flexShrink: 0,
            borderRight: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elev)',
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          <section className="cx-panel" style={{ padding: 16 }}>
            <div className="cx-panel-title">连接</div>

            <label style={{ display: 'block', fontSize: 11, color: 'var(--cx-subtle)', marginBottom: 4 }}>
              示波器地址 / 主机名
            </label>
            <input
              className="input-base"
              data-testid="net-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={connected || busy}
              placeholder="192.168.0.1"
              spellCheck={false}
              style={{ width: '100%', marginBottom: 8 }}
            />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--cx-subtle)', marginBottom: 4 }}>
              gRPC 端口
            </label>
            <input
              className="input-base"
              data-testid="net-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={connected || busy}
              style={{ width: '100%', marginBottom: 10 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="cx-btn cx-btn-primary"
                data-testid="net-connect"
                onClick={connect}
                disabled={busy || connected}
              >
                {busy && !connected ? '连接中…' : '连接'}
              </button>
              <button
                className="cx-btn cx-btn-ghost"
                data-testid="net-disconnect"
                onClick={disconnect}
                disabled={busy || !connected}
              >
                断开
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--cx-subtle)', lineHeight: 1.6 }}>
              仅支持 TekHSI（4/5/6 系 MSO）。先在示波器上启用 TekHSI 服务，并确保本机可访问该 IP。
            </div>
          </section>

          <section className="cx-panel" style={{ padding: 16 }}>
            <div className="cx-panel-title" style={{ display: 'flex', alignItems: 'center' }}>
              通道
              <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 11, color: 'var(--cx-subtle)' }}>
                {selected.length}/{channels.length}
              </span>
            </div>

            {channels.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--cx-subtle)' }}>连接后显示示波器可用通道。</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button
                    className="cx-btn cx-btn-ghost"
                    onClick={() => setSelected([...channels])}
                    disabled={!connected}
                  >
                    全选
                  </button>
                  <button
                    className="cx-btn cx-btn-ghost"
                    onClick={() => setSelected([])}
                    disabled={!connected}
                  >
                    清空
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {channels.map((name) => (
                    <label
                      key={name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        fontFamily: 'monospace'
                      }}
                    >
                      <input
                        type="checkbox"
                        data-testid={`net-channel-${name}`}
                        checked={selected.includes(name)}
                        onChange={() => toggleChannel(name)}
                        disabled={!connected}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="cx-panel" style={{ padding: 16 }}>
            <div className="cx-panel-title">采集</div>
            <button
              className="cx-btn cx-btn-primary"
              data-testid="net-acquire"
              onClick={() => acquire()}
              disabled={!connected || busy || selected.length === 0}
              style={{ width: '100%', marginBottom: 8 }}
            >
              {busy ? '采集中…' : '单次采集'}
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6 }}>
              <input
                type="checkbox"
                data-testid="net-continuous"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
                disabled={!connected}
              />
              连续采集（1 Hz）
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 10 }}>
              <input
                type="checkbox"
                data-testid="net-force"
                onChange={(e) => {
                  setForceSequence(e.target.checked)
                }}
                disabled={!connected}
              />
              强制新采集（RequestNewSequence）
            </label>

            <button
              className="cx-btn cx-btn-ghost"
              data-testid="net-export"
              onClick={exportCsv}
              disabled={!result?.channels.length}
              style={{ width: '100%' }}
            >
              导出 CSV（长格式）
            </button>
          </section>

          {error && (
            <div
              data-testid="net-error"
              style={{
                fontSize: 12,
                color: 'var(--cx-danger, #d1242f)',
                border: '1px solid var(--cx-danger, #d1242f)',
                borderRadius: 8,
                padding: '8px 10px',
                lineHeight: 1.5,
                wordBreak: 'break-word'
              }}
            >
              {error}
            </div>
          )}
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 16 }}>
          {result?.channels.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {result.channels.map((ch, i) => (
                <NetScopeChart key={ch.name} channel={ch} index={i} />
              ))}
              <NetScopeMeta channels={result.channels} capturedAt={result.capturedAt} />
            </div>
          ) : (
            <div
              data-testid="net-empty"
              className="cx-panel"
              style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>尚未采集</div>
              <div style={{ fontSize: 12, color: 'var(--cx-muted)', lineHeight: 1.8 }}>
                1. 输入示波器 IP，端口保持 5000，点击「连接」<br />
                2. 勾选需要采集的模拟通道<br />
                3. 点击「单次采集」；需要连续刷新时打开「连续采集」
              </div>
              <div style={{ fontSize: 11, color: 'var(--cx-subtle)', lineHeight: 1.7 }}>
                走 Tektronix TekHSI（gRPC），不是 VXI-11/SCPI。浏览器不能直接开 TCP，
                由本机 Next 服务端代理连接示波器。数字通道 / IQ / FastFrame 暂不支持。
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
