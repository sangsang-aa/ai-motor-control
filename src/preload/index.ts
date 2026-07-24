import { contextBridge, ipcRenderer } from 'electron'
import type { BackendEvent, LlmEvent, MotorStatus, Session } from '../shared/types'

const api = {
  connect: (port: string, baud: number): Promise<void> => ipcRenderer.invoke('motor:connect', port, baud),
  disconnect: (): Promise<void> => ipcRenderer.invoke('motor:disconnect'),
  sendCommand: (action: string, payload: Record<string, unknown>): Promise<string> => ipcRenderer.invoke('motor:sendCommand', action, payload),
  requestStatus: (): Promise<MotorStatus> => ipcRenderer.invoke('motor:requestStatus'),
  openMotorWindow: (): Promise<void> => ipcRenderer.invoke('motor:openWindow'),
  closeMotorWindow: (): Promise<void> => ipcRenderer.invoke('motor:closeWindow'),
  sendMessage: (text: string, history: unknown[]): Promise<void> => ipcRenderer.invoke('llm:sendMessage', text, history),
  interrupt: (): Promise<void> => ipcRenderer.invoke('llm:interrupt'),
  listSessions: (): Promise<Session[]> => ipcRenderer.invoke('llm:listSessions'),
  deleteSession: (id: string): Promise<void> => ipcRenderer.invoke('llm:deleteSession', id),
  renameSession: (id: string, title: string): Promise<void> => ipcRenderer.invoke('llm:renameSession', id, title),
  saveSession: (session: Session): Promise<void> => ipcRenderer.invoke('session:save', session),
  generateReport: (): Promise<string> => ipcRenderer.invoke('export:generateReport'),
  onBackendEvent: (cb: (e: BackendEvent) => void): (() => void) => {
    const h = (_e: Electron.IpcRendererEvent, e: BackendEvent) => cb(e)
    ipcRenderer.on('motor:event', h); return () => ipcRenderer.removeListener('motor:event', h)
  },
  onLlmEvent: (cb: (e: LlmEvent) => void): (() => void) => {
    const h = (_e: Electron.IpcRendererEvent, e: LlmEvent) => cb(e)
    ipcRenderer.on('llm:event', h); return () => ipcRenderer.removeListener('llm:event', h)
  },
  winMinimize: () => ipcRenderer.invoke('window:minimize'),
  winMaximize: () => ipcRenderer.invoke('window:maximize'),
  winClose: () => ipcRenderer.invoke('window:close'),
  chartMinimize: () => ipcRenderer.invoke('chart:minimize'),
  chartMaximize: () => ipcRenderer.invoke('chart:maximize'),
  chartClose: () => ipcRenderer.invoke('chart:close'),
  openReport: (path: string) => ipcRenderer.invoke('report:open', path)
}
contextBridge.exposeInMainWorld('api', api)
