import { ipcMain } from 'electron'
import { PythonBackendController } from './pythonBridge'
import { SessionManager } from './sessions'
import { LlmProxy } from './llmProxy'
import { readConfig } from './config'
import { generateReport } from './reportGenerator'
import { getMainWindow, getMotorWindow, openMotorWindow } from './index'

let backend: PythonBackendController
let llmProxy: LlmProxy
let sessionManager: SessionManager

export function getBackend(): PythonBackendController { return backend }

function broadcast(event: any) {
  const mw = getMotorWindow(); const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('motor:event', event)
  if (mw && !mw.isDestroyed()) mw.webContents.send('motor:event', event)
}

export function registerIpcHandlers(): void {
  backend = new PythonBackendController(getMainWindow()!, broadcast)
  llmProxy = new LlmProxy(getMainWindow()!)
  sessionManager = new SessionManager()

  // Motor
  ipcMain.handle('motor:startBackend', async () => { await backend.start(readConfig()) })
  ipcMain.handle('motor:stopBackend', async () => { await backend.stop() })
  ipcMain.handle('motor:reconnect', async (_e, port: string, baud: number) => {
    const cfg = readConfig(); cfg.motor.port = port; cfg.motor.baudRate = baud
    await backend.stop(); await backend.start(cfg)
  })
  ipcMain.handle('motor:sendCommand', async (_e, action: string, payload: Record<string, unknown>) => backend.sendCommand(action, payload))
  ipcMain.handle('motor:requestStatus', async () => backend.requestStatus())
  ipcMain.handle('motor:openWindow', async () => { openMotorWindow() })
  ipcMain.handle('motor:closeWindow', async () => { const mw = getMotorWindow(); if (mw && !mw.isDestroyed()) mw.close() })

  // LLM
  ipcMain.handle('llm:sendMessage', async (_e, text: string, history: unknown[]) => {
    await llmProxy.sendMessage(text, history, readConfig())
  })
  ipcMain.handle('llm:interrupt', async () => { llmProxy.abort(); backend.interrupt() })

  // Sessions
  ipcMain.handle('llm:listSessions', async () => sessionManager.list())
  ipcMain.handle('llm:deleteSession', async (_e, id: string) => { sessionManager.delete(id) })
  ipcMain.handle('llm:renameSession', async (_e, id: string, title: string) => { sessionManager.rename(id, title) })
  ipcMain.handle('session:save', async (_e, session: any) => { sessionManager.upsert(session) })

  // Report
  ipcMain.handle('export:generateReport', async () => {
    const sessions = sessionManager.list(); if (sessions.length === 0) return ''; return generateReport(sessions[0])
  })
}
