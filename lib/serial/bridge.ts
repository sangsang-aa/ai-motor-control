/**
 * WebSocket 桥接串口 — 替代 Web Serial:浏览器 → ws://127.0.0.1:8765(本地 serial_bridge.py)。
 * 桥接服务独占 COM 口并把每帧 Modbus 通讯 RT 打印到控制台,实现"上位机测试 + 监控日志"并行。
 *
 * 接口形状与 Web Serial 对齐(readable/writable/getInfo/close),
 * 可直接被 motorController 当作 SerialPort 使用,业务层零改动。
 * 依赖: 桥接工具 E:\f280025c_modbus_slave\tools\serial_bridge.py(与固件同周)。
 *
 * 握手协议: 桥接受连接后发送文本 "READY OK"(成功)或 "ERROR: ..."(串口不可用)。
 */

const HANDSHAKE = 'READY'

export class BridgePort {
  private ws: WebSocket
  private readableCtrl: ReadableStreamDefaultController<Uint8Array> | null = null
  private queue: Uint8Array[] = []
  private pendingPull: (() => void) | null = null
  private streamClosed = false

  readable!: ReadableStream<Uint8Array>
  writable!: WritableStream<Uint8Array>

  private constructor(ws: WebSocket) {
    this.ws = ws
  }

  /** 连接桥接服务并等待握手(READY)完成;桥端 ERROR/超时/失败均抛错。 */
  static async open(url: string, timeoutMs = 5000): Promise<BridgePort> {
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    const port = new BridgePort(ws)
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try { ws.close() } catch { /* 忽略 */ }
        reject(err)
      }
      const timer = setTimeout(() => fail(new Error(`桥接连接超时: ${url}(需先启动 serial_bridge.py)`)), timeoutMs)
      ws.onerror = () => fail(new Error(`无法连接桥接服务: ${url}`))
      ws.onclose = () => {
        port.notifyClosed()
        if (!settled) fail(new Error('桥接已在连接完成前断开'))
      }
      ws.onmessage = (ev) => {
        // 文本帧 = 握手结果;二进制帧 = 串口数据(RX),任何时刻都入口转发
        if (typeof ev.data === 'string') {
          if (settled) return
          if (ev.data.includes(HANDSHAKE)) {
            settled = true
            clearTimeout(timer)
            resolve()
          } else if (ev.data.trimStart().startsWith('ERROR')) {
            fail(new Error(ev.data.replace(/^ERROR:\s*/, '')))
          }
          return
        }
        port.enqueue(new Uint8Array(ev.data as ArrayBuffer))
      }
    })
    port.init()
    return port
  }

  private init(): void {
    this.readable = new ReadableStream<Uint8Array>({
      start: (c) => {
        this.readableCtrl = c
      },
      pull: () => {
        if (this.queue.length > 0) {
          this.readableCtrl!.enqueue(this.queue.shift()!)
          return Promise.resolve()
        }
        if (this.streamClosed) {
          this.readableCtrl?.close()
          return Promise.resolve()
        }
        return new Promise<void>((resolve) => {
          this.pendingPull = resolve
        })
      }
    })
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          return Promise.reject(new Error('桥接已断开'))
        }
        this.ws.send(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer)
      }
    })
  }

  private enqueue(buf: Uint8Array): void {
    if (this.streamClosed) return
    if (this.pendingPull) {
      const p = this.pendingPull
      this.pendingPull = null
      this.readableCtrl!.enqueue(buf)
      p()
    } else {
      this.queue.push(buf)
    }
  }

  private notifyClosed(): void {
    if (this.streamClosed) return
    this.streamClosed = true
    if (this.pendingPull) {
      const p = this.pendingPull
      this.pendingPull = null
      p()
    }
    try { this.readableCtrl?.close() } catch { /* 已关闭时忽略 */ }
  }

  getInfo(): { usbVendorId: number; usbProductId: number } {
    return { usbVendorId: 0x0451, usbProductId: 0xbee3 }
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close()
    }
    this.notifyClosed()
  }
}
