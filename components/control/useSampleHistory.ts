'use client'

import { useEffect, useRef, useState } from 'react'
import { aiMotorBus } from '@/lib/bus'
import type { Sample } from '@/lib/serial/aimotor/protocol'

const MAX_SAMPLES = 1100

export function useSampleHistory() {
  const bufRef = useRef<Sample[]>([])
  const pausedRef = useRef(false)
  const [, setTick] = useState(0)
  const [paused, setPausedState] = useState(false)

  useEffect(() => {
    const un = aiMotorBus.on((e) => {
      if (e.type !== 'ai_sample' || pausedRef.current) return
      const buf = bufRef.current
      buf.push(e.sample)
      if (buf.length > MAX_SAMPLES) buf.splice(0, buf.length - MAX_SAMPLES)
    })
    const id = setInterval(() => setTick((v) => v + 1), 100)
    return () => {
      un()
      clearInterval(id)
    }
  }, [])

  const setPaused = (p: boolean) => {
    pausedRef.current = p
    setPausedState(p)
  }

  const clear = () => {
    bufRef.current = []
    setTick((v) => v + 1)
  }

  return { samples: bufRef.current, paused, setPaused, clear }
}
