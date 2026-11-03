// Shared TekHSI types (client + server). No Node/gRPC imports here.

export interface TekChannel {
  /** Scope channel name, e.g. "ch1". */
  name: string
  /** Vertical unit reported by the header, e.g. "V" or "A". */
  yUnits: string
  /** Horizontal unit reported by the header, usually "s". */
  xUnits: string
  /** Sample spacing (seconds). */
  dt: number
  /** Index of the trigger sample (x = 0). */
  triggerIndex: number
  /** y = raw * ySpacing + yOffset. Kept for display/export metadata. */
  ySpacing: number
  yOffset: number
  /** Original record length reported by the header. */
  points: number
  /** Number of decoded samples before decimation. */
  samples: number
  /** Decimation stride (1 = full resolution, 2 = every 2nd sample, ...). */
  stride: number
  /** Scaled vertical values (after decimation). */
  y: number[]
}

export interface TekAcquireResult {
  capturedAt: number
  channels: TekChannel[]
  errors: { name: string; error: string }[]
}

export interface TekConnectResult {
  host: string
  port: number
  protocolVersion: number
  capabilities: number
  channels: string[]
}

export interface TekStatus {
  connected: boolean
  host?: string
  port?: number
  protocolVersion?: number
  capabilities?: number
  channels?: string[]
}

export interface TekApiError {
  error: string
}
