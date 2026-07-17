import { ChildProcess, spawn } from 'child_process'
import { createInterface } from 'readline'
import { join } from 'path'
import type { BackendEvent } from '../shared/types'

const PYTHON_BACKEND = join(__dirname, '../../python_backend/main.py')

export class PythonBackendController {
  private proc: ChildProcess | null = null
  private emitCb: (e: BackendEvent) => void
  private status = { rpm: 0, current: 0, connected: false, port: '', baudRate: 150000 }
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private missedPongs = 0
  private listeners: ((e: BackendEvent) => void)[] = []

  constructor(emit: (e: BackendEvent) => void) { this.emitCb = emit }

  private removeListener(cb: (e: BackendEvent) => void) {
    const idx = this.listeners.indexOf(cb)
    if (idx >= 0) this.listeners.splice(idx, 1)
  }

  async start() {
    if (this.proc) return
    const args = [PYTHON_BACKEND, '--port', '/dev/ttyUSB0', '--baud', '150000', '--rpm-limit', '6000']
    this.proc = spawn('python3', args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1' } })
    const rl = createInterface({ input: this.proc.stdout! })
    rl.on('line', (line: string) => { try { this.handle(JSON.parse(line)) } catch { /* */ } })
    this.proc.stderr?.on('data', (d: Buffer) => console.error('[py]', d.toString()))
    this.proc.on('exit', () => { this.stopHeartbeat(); this.emitCb({ type: 'error', message: 'Python backend exited' }) })
    this.startHeartbeat()
  }

  async stop() {
    this.stopHeartbeat()
    if (!this.proc) return; const p = this.proc; this.proc = null
    p.kill('SIGTERM'); await new Promise(r => setTimeout(r, 3000))
    if (p.exitCode === null) p.kill('SIGKILL')
  }

  // Manual connect/disconnect (user-initiated)
  async connect(port: string, baud: number) {
    if (!this.proc) await this.start()
    this.proc?.stdin?.write(JSON.stringify({ type: 'command', action: 'connect', payload: { port, baud_rate: baud } }) + '\n')
  }
  async disconnect() {
    this.proc?.stdin?.write(JSON.stringify({ type: 'command', action: 'disconnect', payload: {} }) + '\n')
  }

  async sendCommand(action: string, payload: Record<string, unknown>): Promise<string> {
    if (!this.proc?.stdin) return 'backend not running'
    return new Promise(resolve => {
      const cb = (e: BackendEvent) => {
        if (e.type === 'command_result') {
          this.removeListener(cb)
          resolve(e.result || 'OK')
        }
      }
      this.listeners.push(cb)
      this.proc!.stdin!.write(JSON.stringify({ type: 'command', action, payload }) + '\n')
      setTimeout(() => { this.removeListener(cb); resolve('timeout') }, 5000)
    })
  }

  requestStatus() { return { connected: this.status.connected, port: this.status.port, baudRate: this.status.baudRate, rpm: this.status.rpm, currentIa: this.status.current, alarmInfo: '' } }
  interrupt() { this.proc?.stdin?.write(JSON.stringify({ type: 'interrupt' }) + '\n') }

  private startHeartbeat() {
    this.missedPongs = 0
    this.heartbeatTimer = setInterval(() => {
      this.missedPongs++
      if (this.missedPongs >= 2) {
        this.emitCb({ type: 'error', message: 'Python backend unresponsive, restarting...' })
        this.stop(); this.start()
        return
      }
      this.proc?.stdin?.write(JSON.stringify({ type: 'ping' }) + '\n')
    }, 5000)
  }

  private stopHeartbeat() { if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null } }

  private handle(e: BackendEvent) {
    if (e.type === 'serial_status') { this.status.connected = e.connected; this.status.port = e.port; if (e.baudRate) this.status.baudRate = e.baudRate }
    else if (e.type === 'telemetry') { this.status.rpm = e.rpm; this.status.current = e.current }
    else if (e.type === 'pong') { this.missedPongs = 0 }
    for (const cb of this.listeners) { try { cb(e) } catch {} }
    this.emitCb(e)
  }
}
