import type { Page } from '@playwright/test'

export interface AiMotorMockOptions {
  /** ENABLE 后不推送 SAMPLE/MODEL(用于超时/静默测试) */
  silent?: boolean
  /** 首个 HELLO 的 ACK 丢掉一次(验证同 seq 重发) */
  dropFirstAck?: boolean
  /** 连续丢弃 N 个 HELLO ACK(验证握手失败/重连) */
  noHelloAckCount?: number
  /** 覆盖常用 SAMPLE 字段 */
  sample?: { reference?: number; speed?: number; id?: number; iq?: number; iu?: number }
}

/** 把 navigator.serial 模拟为 AI-Motor v1 下位机,不碰真实硬件。 */
export function fakeAiMotorSerial(options: AiMotorMockOptions = {}): string {
  const opts = JSON.stringify(options)
  return `(() => {
    const opts = ${opts};
    const VERSION = 1, COMMAND = 1, SAMPLE = 128, ACK = 129, MODEL = 130, CONFIG = 131;
    const CMD = { HEARTBEAT: 0, STOP: 1, SET_MODE: 2, SET_PARAM: 3, ENABLE: 4, GET_CONFIG: 5, HELLO: 6 };

    function crc16(bytes) {
      let crc = 0xffff;
      for (const byte of bytes) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
      return crc;
    }
    function frame(kind, seq, payload) {
      const p = payload || new Uint8Array(0);
      const size = p.length + 10;
      const out = new Uint8Array(size);
      out[0] = 0xa5; out[1] = 0x5a; out[2] = VERSION; out[3] = kind;
      out[4] = p.length & 0xff; out[5] = (p.length >> 8) & 0xff;
      out[6] = seq & 0xff; out[7] = (seq >> 8) & 0xff;
      out.set(p, 8);
      const crc = crc16(out.subarray(2, size - 2));
      out[size - 2] = crc & 0xff; out[size - 1] = (crc >> 8) & 0xff;
      return out;
    }
    function ackFrame(seq, cmd, status, param, value) {
      const b = new Uint8Array(8), dv = new DataView(b.buffer);
      dv.setUint8(0, cmd); dv.setUint8(1, status); dv.setUint16(2, param, true); dv.setFloat32(4, value, true);
      return frame(ACK, seq, b);
    }
    function sampleFrame(seq, tick, mode, stage, flags, error) {
      const b = new Uint8Array(60), dv = new DataView(b.buffer);
      dv.setUint32(0, tick >>> 0, true); dv.setUint16(4, mode, true); dv.setUint16(6, stage, true);
      dv.setUint16(8, flags, true); dv.setUint16(10, error, true);
      const s = opts.sample || {};
      const vals = [
        s.reference ?? 1500, s.speed ?? 1500, 0, s.id ?? 0, 0, s.iq ?? 0.5,
        s.iu ?? 0.5, -0.25, -0.25, 0.5, 1.2, 0
      ];
      for (let i = 0; i < 12; i++) dv.setFloat32(12 + i * 4, vals[i], true);
      return frame(SAMPLE, seq, b);
    }
    function modelFrame(seq) {
      const b = new Uint8Array(76), dv = new DataView(b.buffer);
      const f = [0.1943, 89.6e-6, 91.5e-6, 90.55e-6, 500, 0.02346, 0.001017, 0.02396, 0.001017, 24];
      for (let i = 0; i < 10; i++) dv.setFloat32(i * 4, f[i], true);
      const u = [5, 0, 4, 1, 1, 3, 1, 0];
      for (let i = 0; i < 8; i++) dv.setUint16(40 + i * 2, u[i], true);
      const w = [1, 0, 0, 0, 0];
      for (let i = 0; i < 5; i++) dv.setUint32(56 + i * 4, w[i], true);
      return frame(MODEL, seq, b);
    }
    function configFrames(seq) {
      const recs = [[1, 6, 0, 1500], [11, 6, 0, 0.004], [12, 6, 0, 0.04], [41, 7, 1, 5]];
      const out = [];
      for (let i = 0; i < recs.length; i += 4) {
        const chunk = recs.slice(i, i + 4);
        const b = new Uint8Array(chunk.length * 8), dv = new DataView(b.buffer);
        chunk.forEach((r, k) => {
          dv.setUint16(k * 8, r[0], true); dv.setUint8(k * 8 + 2, r[1]);
          dv.setUint8(k * 8 + 3, r[2]); dv.setFloat32(k * 8 + 4, r[3], true);
        });
        out.push(frame(CONFIG, seq, b));
      }
      return out;
    }

    window.__aiWrites = [];
    window.__aiOpenOptions = [];
    window.__aiSignals = [];
    window.__aiMode = 5;
    window.__aiEnabled = false;

    let helloDrops = opts.noHelloAckCount || 0;
    let firstAckDropped = false;

    const makePort = () => {
      const port = { readable: null, writable: null };
      let sink = null, seq = 1, tick = 0, sampleTimer = null, modelTimer = null;
      port.readable = new ReadableStream({ start(c) { sink = c; } });
      const send = (bytes) => { try { if (sink) sink.enqueue(bytes); } catch (_) {} };
      const stopStream = () => {
        if (sampleTimer) clearInterval(sampleTimer);
        if (modelTimer) clearInterval(modelTimer);
        sampleTimer = modelTimer = null;
      };
      const startStream = () => {
        if (opts.silent || sampleTimer) return;
        sampleTimer = setInterval(() => {
          tick += 10;
          send(sampleFrame(seq++, tick, window.__aiMode, 3, window.__aiEnabled ? 1 : 0, 0));
        }, 10);
        modelTimer = setInterval(() => send(modelFrame(seq++)), 100);
      };
      port.writable = new WritableStream({
        write(chunk) {
          const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          window.__aiWrites.push(Array.from(bytes));
          if (bytes.length < 10 || bytes[0] !== 0xa5 || bytes[1] !== 0x5a) return;
          const kind = bytes[3];
          const len = bytes[4] | (bytes[5] << 8);
          if (kind !== COMMAND || bytes.length < len + 10) return;
          const reqSeq = bytes[6] | (bytes[7] << 8);
          const dv = new DataView(bytes.buffer, bytes.byteOffset + 8, 8);
          const cmd = dv.getUint8(0), mode = dv.getUint8(1), param = dv.getUint16(2, true), value = dv.getFloat32(4, true);
          if (cmd === CMD.HEARTBEAT) return;
          if (cmd === CMD.HELLO) {
            if (helloDrops > 0) { helloDrops--; return; }
            if (opts.dropFirstAck && !firstAckDropped) { firstAckDropped = true; return; }
            send(ackFrame(reqSeq, cmd, 0, param, value));
            startStream();
            return;
          }
          send(ackFrame(reqSeq, cmd, 0, param, value));
          if (cmd === CMD.SET_MODE) {
            window.__aiMode = mode; window.__aiEnabled = false;
          } else if (cmd === CMD.ENABLE) {
            window.__aiEnabled = true; startStream();
          } else if (cmd === CMD.STOP) {
            window.__aiEnabled = false;
          } else if (cmd === CMD.GET_CONFIG) {
            for (const f of configFrames(seq++)) send(f);
          }
        }
      });
      port.open = async (openOptions) => { window.__aiOpenOptions.push(openOptions); };
      port.close = async () => { stopStream(); };
      port.setSignals = async (signals) => { window.__aiSignals.push(signals); };
      port.getInfo = () => ({ usbVendorId: 0x0451, usbProductId: 0xbef3 });
      return port;
    };

    Object.defineProperty(navigator, 'serial', {
      value: { requestPort: async () => makePort(), getPorts: async () => [] },
      configurable: true
    });
  })()`
}

export function getAiWrites(page: Page): Promise<number[][]> {
  return page.evaluate(() => (window as unknown as { __aiWrites?: number[][] }).__aiWrites || [])
}

export function getAiOpenOptions(page: Page): Promise<unknown[]> {
  return page.evaluate(() => (window as unknown as { __aiOpenOptions?: unknown[] }).__aiOpenOptions || [])
}

export function getAiSignals(page: Page): Promise<unknown[]> {
  return page.evaluate(() => (window as unknown as { __aiSignals?: unknown[] }).__aiSignals || [])
}

export interface AiCommand {
  cmd: number
  mode: number
  param: number
  value: number
}

export function decodeAiCommands(writes: number[][]): AiCommand[] {
  const out: AiCommand[] = []
  for (const w of writes) {
    const bytes = Uint8Array.from(w)
    if (bytes.length < 18 || bytes[0] !== 0xa5 || bytes[1] !== 0x5a || bytes[3] !== 1) continue
    const dv = new DataView(bytes.buffer, bytes.byteOffset + 8, 8)
    out.push({ cmd: dv.getUint8(0), mode: dv.getUint8(1), param: dv.getUint16(2, true), value: dv.getFloat32(4, true) })
  }
  return out
}

export function getAiState(page: Page): Promise<{ mode: number; enabled: boolean }> {
  return page.evaluate(() => {
    const w = window as unknown as { __aiMode?: number; __aiEnabled?: boolean }
    return { mode: w.__aiMode ?? 0, enabled: !!w.__aiEnabled }
  })
}
