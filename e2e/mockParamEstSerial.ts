import type { Page } from '@playwright/test'

/**
 * 把 navigator.serial 模拟为 MCB 参数辨识下位机:
 * 收到控制帧(命令 22, bit0=1)后发送一块 600 帧(SSSS…EEEE)原始数据(逐帧轮发算法变量),
 * 随后停止发送,让上位机靠"空闲超时"判定采集完成。不碰真实硬件。
 */
export function fakeParamEstSerial(options: { zero?: boolean } = {}): string {
  const opts = JSON.stringify(options)
  return `(() => {
    const options = ${opts};
    const HEAD = 0x53535353, TAIL = 0x45454545, N = 5;
    function fbits(v){ const b=new ArrayBuffer(4); new DataView(b).setFloat32(0,v,true); return new DataView(b).getUint32(0,true); }
    function frame(w0,w1,w2){
      const b=new ArrayBuffer(12), dv=new DataView(b);
      dv.setUint32(0,w0>>>0,true); dv.setUint32(4,w1>>>0,true); dv.setUint32(8,w2>>>0,true);
      return new Uint8Array(b);
    }
    function valueAt(i){
      if (options.zero) return 0;
      const ch = i % N;
      if (ch === 0) return 0.00013 * i;
      if (ch === 1) return 0.5;
      if (ch === 2) return 0.001 * i;
      if (ch === 3) return 0.2;
      return 1500;
    }
    function block(){
      const fs=[frame(HEAD, fbits(valueAt(0)), fbits(0))];
      for(let i=1;i<=598;i++) fs.push(frame(fbits(valueAt(i)), fbits(0), 0));
      fs.push(frame(fbits(valueAt(599)), fbits(0), TAIL));
      const total=fs.reduce((s,f)=>s+f.length,0);
      const out=new Uint8Array(total); let o=0; for(const f of fs){ out.set(f,o); o+=f.length; }
      return out;
    }
    window.__peWrites = [];
    const makePort = () => {
      const port = { readable:null, writable:null };
      let sink = null;
      const stream = new ReadableStream({ start(c){ sink = c; } });
      port.readable = stream;
      port.writable = new WritableStream({ write(chunk){
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        window.__peWrites.push(Array.from(bytes));
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const cmd = dv.getFloat32(0,true), val = dv.getFloat32(4,true);
        if (cmd === 22 && (val & 1) === 1 && sink) sink.enqueue(block());
      }});
      port.open = async () => {};
      port.close = async () => {};
      port.setSignals = async () => {};
      port.getInfo = () => ({ usbVendorId: 0x2345, usbProductId: 0x6789 });
      return port;
    };
    Object.defineProperty(navigator, 'serial', {
      value: { requestPort: async () => makePort(), getPorts: async () => [] },
      configurable: true
    });
  })()`
}

export function getPeWrites(page: Page): Promise<number[][]> {
  return page.evaluate(() => (window as unknown as { __peWrites?: number[][] }).__peWrites || [])
}
