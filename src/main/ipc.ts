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

export function getBackend() { return backend }

function broadcast(e: any) {
  const mw = getMotorWindow(); const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('motor:event', e)
  if (mw && !mw.isDestroyed()) mw.webContents.send('motor:event', e)
}

export function registerIpcHandlers(): void {
  backend = new PythonBackendController(broadcast)
  llmProxy = new LlmProxy(getMainWindow()!)
  sessionManager = new SessionManager()

  // Manual connect/disconnect (replaces auto-connect)
  ipcMain.handle('motor:connect', async (_e, port: string, baud: number) => { await backend.connect(port, baud) })
  ipcMain.handle('motor:disconnect', async () => { await backend.disconnect() })
  ipcMain.handle('motor:sendCommand', async (_e, action: string, payload: Record<string, unknown>) => {
    const result = await backend.sendCommand(action, payload)
    // Notify renderer that command execution completed (for lock release)
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.webContents.send('motor:event', { type: 'executed', action, result })
    return result
  })
  ipcMain.handle('motor:requestStatus', async () => backend.requestStatus())
  ipcMain.handle('motor:openWindow', async () => { openMotorWindow() })
  ipcMain.handle('motor:closeWindow', async () => { const mw = getMotorWindow(); if (mw && !mw.isDestroyed()) mw.close() })

  ipcMain.handle('llm:sendMessage', async (_e, text: string, history: unknown[]) => {
    await llmProxy.sendMessage(text, history, readConfig())
  })
  ipcMain.handle('llm:interrupt', async () => { llmProxy.abort(); backend.interrupt() })

  ipcMain.handle('llm:listSessions', async () => sessionManager.list())
  ipcMain.handle('llm:deleteSession', async (_e, id: string) => { sessionManager.delete(id) })
  ipcMain.handle('llm:renameSession', async (_e, id: string, title: string) => { sessionManager.rename(id, title) })
  ipcMain.handle('session:save', async (_e, session: any) => { sessionManager.upsert(session) })
  ipcMain.handle('export:generateReport', async () => {
    const sessions = sessionManager.list(); if (sessions.length === 0) return ''; return generateReport(sessions[0])
  })
}
