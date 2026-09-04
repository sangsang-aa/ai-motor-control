import { ADDR } from '@/lib/serial/modbus'
import type { Page } from '@playwright/test'

// ── 快速 CRC16(浏览器端 mock 用,与 lib/serial/modbus.ts 算法一致) ──
function crc16(buf: Uint8Array): number {
  let crc = 0xffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
    }
  }
  return crc & 0xffff
}
function pack(pdu: number[]): number[] {
  const body = Uint8Array.from(pdu)
  const crc = crc16(body)
  return [...pdu, crc & 0xff, (crc >> 8) & 0xff]
}
function f32Regs(f: number): [number, number] {
  const buf = new DataView(new ArrayBuffer(4))
  buf.setFloat32(0, f, false)
  return [buf.getUint16(0, false), buf.getUint16(2, false)]
}

// 默认遥测值:实际转速 2000 RPM,电流 3.0 A(供轮询读到非零)。
// 扁平 [addr, hi, lo, ...],脚本端按每 3 个还原成两个寄存器(addr=hi, addr+1=lo)。
const INITIAL: number[] = [
  ADDR.ACTUAL_SPEED, ...f32Regs(2000),
  ADDR.ACTUAL_CURRENT, ...f32Regs(3.0)
]

// 生成给 addInitScript 的脚本:把 navigator.serial 模拟为 Modbus 从站(请求-响应)
export function fakeSerialInitScript(): string {
  const initialEntries = JSON.stringify(INITIAL)
  return `(() => {
    const initFlat = ${initialEntries};
    const holding = new Map();
    for (let i = 0; i < initFlat.length; i += 3) {
      holding.set(initFlat[i], initFlat[i+1]);
      holding.set(initFlat[i] + 1, initFlat[i+2]);
    }
    const coils = new Map([[0x0000,false],[0x0001,false],[0x0002,false]]);
    window.__sfWrites = [];
    let pushResp = null;
    const crcp = (pdu) => {
      const body = Uint8Array.from(pdu);
      let crc = 0xffff;
      for (let i=0;i<body.length;i++){ crc ^= body[i]; for (let j=0;j<8;j++){ crc = crc&1 ? (crc>>1)^0xa001 : crc>>1; } }
      return [...pdu, crc & 0xff, (crc>>8)&0xff];
    };
    const handle = (req) => {
      const slave = req[0], func = req[1];
      if (func === 0x03) {
        const addr = (req[2]<<8)|req[3], count = (req[4]<<8)|req[5];
        const regs = [];
        for (let i=0;i<count;i++) regs.push(holding.get(addr+i) ?? 0);
        const data = [];
        for (const r of regs) data.push(r>>8, r&0xff);
        return crcp([slave, 3, data.length, ...data]);
      }
      if (func === 0x06) {
        const addr = (req[2]<<8)|req[3], val = (req[4]<<8)|req[5];
        holding.set(addr, val);
        return crcp([slave, 6, req[2], req[3], req[4], req[5]]);
      }
      if (func === 0x10) {
        const addr = (req[2]<<8)|req[3], count = (req[4]<<8)|req[5];
        for (let i=0;i<count;i++){ const lo = 7 + i*2; holding.set(addr+i, (req[lo]<<8)|req[lo+1]); }
        return crcp([slave, 0x10, req[2], req[3], req[4], req[5]]);
      }
      if (func === 0x05) {
        const addr = (req[2]<<8)|req[3];
        coils.set(addr, ((req[4]<<8)|req[5]) === 0xff00);
        return crcp([slave, 5, req[2], req[3], req[4], req[5]]);
      }
      if (func === 0x01) {
        const addr = (req[2]<<8)|req[3], count = (req[4]<<8)|req[5];
        const bytes = [];
        let byte = 0;
        for (let i=0;i<count;i++){
          if (coils.get(addr+i)) byte |= 1<<(i&7);
        }
        bytes.push(byte);
        return crcp([slave, 1, bytes.length, ...bytes]);
      }
      return crcp([slave, func | 0x80, 0x01]);
    };

    const makePort = () => {
      const port = { readable: null, writable: null };
      const stream = new ReadableStream({ start(c){ pushResp = c; } });
      port.readable = stream;
      port.writable = new WritableStream({
        write(chunk) {
          window.__sfWrites.push(Array.from(chunk));
          const req = Array.from(chunk);
          const resp = handle(req);
          if (pushResp) pushResp.enqueue(new Uint8Array(resp));
        }
      });
      port.open = async () => {};
      port.close = async () => {};
      port.getInfo = () => ({ usbVendorId: 0x2345, usbProductId: 0x6789 });
      return port;
    };
    Object.defineProperty(navigator, 'serial', {
      value: { requestPort: async () => makePort(), getPorts: async () => [] },
      configurable: true
    });
  })()`
}

// 读取测试期间写入的串口字节(Modbus 请求帧)
export function getSerialWrites(page: Page): Promise<number[][]> {
  return page.evaluate(() => (window as any).__sfWrites || [])
}
