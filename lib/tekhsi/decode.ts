// TekHSI raw waveform decoding helpers (pure, testable in jsdom/node).

export interface Decimated {
  values: number[]
  stride: number
}

/**
 * Decode TekHSI NativeData samples and apply the header scaling.
 *
 * sourcewidth 1/2/4 → int8 / int16 (little-endian) / float32 (little-endian),
 * then y = raw * ySpacing + yOffset (same rule as the official Python
 * tm_data_types AnalogWaveform.normalized_vertical_values).
 */
export function decodeAnalog(
  data: Uint8Array,
  sourcewidth: number,
  ySpacing: number,
  yOffset: number
): number[] {
  if (![1, 2, 4].includes(sourcewidth)) {
    throw new Error(`不支持的 sourcewidth=${sourcewidth}（仅支持 1/2/4）`)
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const count = Math.floor(data.byteLength / sourcewidth)
  const out = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    const o = i * sourcewidth
    const raw =
      sourcewidth === 1
        ? view.getInt8(o)
        : sourcewidth === 2
          ? view.getInt16(o, true)
          : view.getFloat32(o, true)
    out[i] = raw * ySpacing + yOffset
  }
  return out
}

/** Keep at most maxPoints samples by taking every Nth sample. */
export function decimate(values: number[], maxPoints: number): Decimated {
  if (!Number.isFinite(maxPoints) || maxPoints <= 0 || values.length <= maxPoints) {
    return { values, stride: 1 }
  }
  const stride = Math.ceil(values.length / maxPoints)
  const out: number[] = []
  for (let i = 0; i < values.length; i += stride) out.push(values[i])
  return { values: out, stride }
}

/** Time of a sample relative to the trigger (x = 0). */
export function timeAt(index: number, dt: number, triggerIndex: number): number {
  return (index - triggerIndex) * dt
}

/** Format seconds with an auto unit (ns / µs / ms / s). */
export function formatTime(seconds: number): string {
  const abs = Math.abs(seconds)
  if (abs < 1e-6) return `${(seconds * 1e9).toFixed(1)} ns`
  if (abs < 1e-3) return `${(seconds * 1e6).toFixed(1)} µs`
  if (abs < 1) return `${(seconds * 1e3).toFixed(2)} ms`
  return `${seconds.toFixed(3)} s`
}

/** Compact engineering-number formatting for axis labels. */
export function formatValue(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e6) return `${(v / 1e6).toPrecision(3)}M`
  if (abs >= 1e3) return `${(v / 1e3).toPrecision(3)}k`
  if (abs >= 1) return v.toPrecision(4)
  if (abs >= 1e-3) return (v * 1e3).toPrecision(3) + 'm'
  if (abs >= 1e-6) return (v * 1e6).toPrecision(3) + 'µ'
  return v.toExponential(2)
}
