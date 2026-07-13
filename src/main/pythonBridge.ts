import { ChildProcess, spawn } from 'child_process'
import { BrowserWindow } from 'electron'
import { createInterface } from 'readline'
import { join } from 'path'
import { AppConfig } from './config'
import type { BackendEvent } from '../shared/types'

const PYTHON_BACKEND = join(__dirname, '../../python_backend/main.py')

export class PythonBackendController {
  private proc: ChildProcess | null = null
  private emitCb: (e: BackendEvent) => void
  private status = { rpm: 0, current: 0, connected: false, port: '' as string }

  constructor(win: BrowserWindow, emit: (e: BackendEvent) => void) { this.emitCb = emit }

  async start(cfg: AppConfig): Promise<void> {
    if (this.proc) await this.stop()
    const args = [PYTHON_BACKEND, '--port', cfg.motor.port, '--baud', String(cfg.motor.baudRate), '--rpm-limit', String(cfg.motor.rpmLimit)]
    this.proc = spawn('python3', args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1' } })
    const rl = createInterface({ input: this.proc.stdout! })
    rl.on('line', (line: string) => { try { this.handle(JSON.parse(line)) } catch { /* */ } })
    this.proc.stderr?.on('data', (d: Buffer) => console.error('[py]', d.toString()))
    this.proc.on('exit', (code) => this.emitCb({ type: 'error', message: `Python backend exited (code=${code})` }))
  }

  async stop(): Promise<void> {
    if (!this.proc) return; const p = this.proc; this.proc = null
    p.kill('SIGTERM'); await new Promise(r => setTimeout(r, 3000))
    if (p.exitCode === null) p.kill('SIGKILL')
  }

  async sendCommand(action: string, payload: Record<string, unknown>): Promise<string> {
    if (!this.proc?.stdin) return 'backend not running'
    return new Promise(resolve => {
      const onData = (d: Buffer) => {
        for (const line of d.toString().trim().split('\n')) {
          try { const ev = JSON.parse(line); if (ev.type === 'command_result') { this.proc?.stdout?.removeListener('data', onData); resolve(ev.result || 'OK'); return } } catch { /* */ }
        }
      }
      this.proc?.stdout?.on('data', onData)
      this.proc!.stdin!.write(JSON.stringify({ type: 'command', action, payload }) + '\n')
      setTimeout(() => { this.proc?.stdout?.removeListener('data', onData); resolve('timeout') }, 5000)
    })
  }

  requestStatus() { return { ...this.status } }
  interrupt() { if (this.proc?.stdin) this.proc.stdin.write(JSON.stringify({ type: 'interrupt' }) + '\n') }
  private handle(e: BackendEvent) { if (e.type === 'serial_status') { this.status.connected = e.connected; this.status.port = e.port } else if (e.type === 'telemetry') { this.status.rpm = e.rpm; this.status.current = e.current }; this.emitCb(e) }
}
