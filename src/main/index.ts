import { app, BrowserWindow } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let motorWindow: BrowserWindow | null = null

export function getMainWindow() { return mainWindow }
export function getMotorWindow() { return motorWindow }

export function openMotorWindow(): BrowserWindow {
  if (motorWindow && !motorWindow.isDestroyed()) { motorWindow.focus(); return motorWindow }
  motorWindow = new BrowserWindow({
    width: 1000, height: 700, minWidth: 600, minHeight: 400,
    title: 'Motor Monitor',
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), contextIsolation: true, nodeIntegration: false, sandbox: false },
    backgroundColor: '#0a1628', show: false
  })
  motorWindow.on('ready-to-show', () => motorWindow?.show())
  motorWindow.on('closed', () => {
    motorWindow = null
    const mw = getMainWindow()
    if (mw && !mw.isDestroyed()) mw.webContents.send('motor:event', { type: 'chart_closed' })
  })
  motorWindow.loadFile(join(__dirname, '../renderer/motor.html'))
  return motorWindow
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400, height: 850, minWidth: 900, minHeight: 500,
    title: 'AI Motor Control',
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), contextIsolation: true, nodeIntegration: false, sandbox: false },
    backgroundColor: '#0a1628', show: false
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

import { registerIpcHandlers, getBackend } from './ipc'

app.whenReady().then(() => {
  createMainWindow()
  registerIpcHandlers()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { getBackend().stop().catch(() => {}) })
