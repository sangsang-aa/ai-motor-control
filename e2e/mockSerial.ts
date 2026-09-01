import { FrameAssembler } from '@/lib/serial/protocol'

// 造若干帧字节(每帧 600 对 [Ia, Speed]),供 fake serial 周期吐出。
// Ia = 500 + 300*sin, Speed = 500 - 300*sin → 波形明显。
export function buildWaveformBytes(frames = 5): number[][] {
  const bytesList: number[][] = []
  for (let f = 0; f < frames; f++) {
    const rows: number[][] = []
    for (let i = 0; i < 600; i++) {
      const s = Math.sin(i / 20)
      rows.push([Math.round(500 + 300 * s), Math.round(500 - 300 * s)])
    }
    bytesList.push(Array.from(FrameAssembler.buildFrame(rows)))
  }
  return bytesList
}

// 返回给 addInitScript 的脚本字符串:覆盖 navigator.serial 为 fake 实现。
// readable 周期吐出预置帧,writable 记录写入字节到 window.__sfWrites。
export function fakeSerialInitScript(framesBytes: number[][]): string {
  const framesJson = JSON.stringify(framesBytes)
  return `(() => {
    const frames = ${framesJson};
    window.__sfWrites = [];
    let port = null;
    const makePort = () => {
      port = { readable: null, writable: null };
      port.open = async () => {
        let i = 0;
        const stream = new ReadableStream({
          start(c) {
            const push = () => { c.enqueue(new Uint8Array(frames[i % frames.length])); i++; };
            push();
            setInterval(push, 50);
          }
        });
        port.readable = stream;
        port.writable = new WritableStream({
          write(chunk) { window.__sfWrites.push(Array.from(chunk)); }
        });
      };
      port.close = async () => {};
      port.getInfo = () => ({ usbVendorId: 0x2345, usbProductId: 0x6789 });
      return port;
    };
    // Chromium 原生 navigator.serial 是只读 getter,需 defineProperty 覆盖
    Object.defineProperty(navigator, 'serial', { value: { requestPort: async () => makePort(), getPorts: async () => [] }, configurable: true });
  })()`
}

// 读取测试期间写入的串口命令(即 sendCommand 编码后的字节)
export function getSerialWrites(page: import('@playwright/test').Page): Promise<number[][]> {
  return page.evaluate(() => (window as any).__sfWrites || [])
}
