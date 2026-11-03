'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TekAcquireResult, TekConnectResult, TekStatus } from '@/lib/tekhsi/types'

const LS_HOST = 'mototune.tekhsi.host'
const LS_PORT = 'mototune.tekhsi.port'

async function post(body: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/tekhsi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) throw new Error(json?.error || `HTTP ${res.status}`)
  return json
}

export function useTekHsi() {
  const [host, setHostState] = useState('192.168.0.1')
  const [port, setPortState] = useState('5000')
  const [status, setStatus] = useState<TekStatus>({ connected: false })
  const [channels, setChannels] = useState<string[]>([])
  const [selected, setSelectedState] = useState<string[]>([])
  const [result, setResult] = useState<TekAcquireResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [continuous, setContinuousState] = useState(false)
  const busyRef = useRef(false)
  const selectedRef = useRef<string[]>([])
  const forceRef = useRef(false)

  const setSelected = useCallback((next: string[]) => {
    selectedRef.current = next
    setSelectedState(next)
  }, [])

  useEffect(() => {
    try {
      const h = localStorage.getItem(LS_HOST)
      const p = localStorage.getItem(LS_PORT)
      if (h) setHostState(h)
      if (p) setPortState(p)
    } catch {
      // localStorage may be unavailable (private mode); defaults are fine.
    }
  }, [])

  const setHost = useCallback((v: string) => {
    setHostState(v)
    try { localStorage.setItem(LS_HOST, v) } catch {}
  }, [])

  const setPort = useCallback((v: string) => {
    setPortState(v)
    try { localStorage.setItem(LS_PORT, v) } catch {}
  }, [])

  const connect = useCallback(async () => {
    setBusy(true)
    busyRef.current = true
    setError('')
    try {
      const r: TekConnectResult = await post({
        action: 'connect',
        host: host.trim(),
        port: Number(port)
      })
      setChannels(r.channels)
      setSelected(r.channels.slice(0, 2))
      setStatus({
        connected: true,
        host: r.host,
        port: r.port,
        protocolVersion: r.protocolVersion,
        capabilities: r.capabilities,
        channels: r.channels
      })
      setResult(null)
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }, [host, port, setSelected])

  const disconnect = useCallback(async () => {
    setContinuousState(false)
    setBusy(true)
    busyRef.current = true
    setError('')
    try {
      await post({ action: 'disconnect' })
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setStatus({ connected: false })
      setChannels([])
      setSelected([])
      setResult(null)
      setBusy(false)
      busyRef.current = false
    }
  }, [setSelected])

  const acquire = useCallback(async (force = forceRef.current) => {
    if (busyRef.current) return
    const names = selectedRef.current
    if (!names.length) {
      setError('请选择至少一个通道')
      return
    }
    setBusy(true)
    busyRef.current = true
    setError('')
    try {
      const r: TekAcquireResult = await post({
        action: 'acquire',
        channels: names,
        forceSequence: force
      })
      setResult(r)
      if (r.errors?.length) {
        setError(r.errors.map((x) => `${x.name}: ${x.error}`).join('；'))
      }
    } catch (e) {
      setError(String((e as Error)?.message || e))
      setContinuousState(false)
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!continuous) return
    const id = setInterval(() => { void acquire(forceRef.current) }, 1000)
    return () => clearInterval(id)
  }, [continuous, acquire])

  return {
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
    setContinuous: setContinuousState,
    setForceSequence: (v: boolean) => { forceRef.current = v },
    connect,
    disconnect,
    acquire,
    setError
  }
}
