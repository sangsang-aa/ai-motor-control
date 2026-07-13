import type { MotraApi } from '../shared/types'

declare global {
  interface Window {
    api: MotraApi
  }
}
