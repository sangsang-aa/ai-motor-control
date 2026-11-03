// CSV helpers for TekHSI acquisitions (client-safe).

import type { TekChannel } from './types'

/**
 * Long-format CSV: one row per sample, so channels with different time bases
 * or record lengths can be exported without alignment problems.
 */
export function toLongCsv(channels: TekChannel[]): string {
  const lines = ['channel,time_s,value']
  for (const ch of channels) {
    for (let i = 0; i < ch.y.length; i++) {
      const index = i * ch.stride
      const t = (index - ch.triggerIndex) * ch.dt
      lines.push(`${ch.name},${t.toPrecision(12)},${ch.y[i]}`)
    }
  }
  return lines.join('\n') + '\n'
}

/** Trigger a browser download for a text file. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
