import { describe, it, expect, beforeEach } from 'vitest'
import { useScopeStore } from '@/lib/stores/scopeStore'

beforeEach(() => {
  localStorage.clear()
  const s = useScopeStore.getState()
  s.resetBuffers()
  s.setPaused(false)
  s.setN(4000)
})

describe('scopeStore channel config & persistence', () => {
  it('sets channel labels / enabled / range', () => {
    const s = useScopeStore.getState()
    s.setChannelLabel(0, 'Iu (A)')
    s.setChannelYRange(0, 500)
    const st = useScopeStore.getState()
    expect(st.channels[0].label).toBe('Iu (A)')
    expect(st.channels[0].yRange).toBe(500)
  })

  it('persists and hydrates channel view config', () => {
    const s = useScopeStore.getState()
    s.setChannelLabel(1, 'Speed (RPM)')
    s.persistToStorage()
    useScopeStore.setState((st) => ({ channels: st.channels.map((c) => ({ ...c, label: '' })) }))
    useScopeStore.getState().hydrateFromStorage()
    const st = useScopeStore.getState()
    expect(st.channels[1].label).toBe('Speed (RPM)')
  })
})
