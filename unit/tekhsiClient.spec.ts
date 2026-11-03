// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'node:path'
import { acquire, connect, disconnect, status } from '@/lib/tekhsi/client'

const PROTO = path.join(process.cwd(), 'lib/tekhsi/TekHighspeedServer.proto')

let server: grpc.Server
let port = 0
let newSequenceCalls = 0

function int16Bytes(values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 2)
  values.forEach((v, i) => buf.writeInt16LE(v, i * 2))
  return buf
}

beforeAll(async () => {
  const definition = protoLoader.loadSync(PROTO, {
    keepCase: true,
    longs: Number,
    enums: Number,
    defaults: true,
    oneofs: true
  })
  const pkg: any = grpc.loadPackageDefinition(definition)
  server = new grpc.Server()

  server.addService(pkg.Tekscope.Connect.service, {
    Connect: (_call: any, cb: any) =>
      cb(null, { status: 1, protocol_version: 200, capabilities: 3 }),
    Disconnect: (_call: any, cb: any) => cb(null, { status: 1 }),
    RequestNewSequence: (_call: any, cb: any) => {
      newSequenceCalls += 1
      cb(null, { status: 1 })
    },
    RequestAvailableNames: (_call: any, cb: any) =>
      cb(null, { status: 1, symbolnames: ['CH1', 'CH2'] }),
    WaitForDataAccess: (_call: any, cb: any) => cb(null, { status: 1 }),
    FinishedWithDataAccess: (_call: any, cb: any) => cb(null, { status: 1 })
  })

  server.addService(pkg.Tekscope.NativeData.service, {
    GetHeader: (call: any, cb: any) =>
      cb(null, {
        status: 1,
        headerordata: {
          header: {
            sourcename: call.request.sourcename,
            sourcewidth: 2,
            noofsamples: 4,
            wfmtype: 2,
            verticalspacing: 0.5,
            verticaloffset: -1,
            horizontalspacing: 1e-6,
            horizontalzeroindex: 1,
            hasdata: true,
            verticalunits: 'V',
            horizontalUnits: 's'
          }
        }
      }),
    GetWaveform: (call: any) => {
      call.write({
        status: 1,
        headerordata: {
          chunk: { data: int16Bytes([0, 100, -100, 200]) }
        }
      })
      call.end()
    }
  })

  port = await new Promise<number>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, p) =>
      err ? reject(err) : resolve(p)
    )
  })
})

afterAll(async () => {
  await disconnect()
  server.forceShutdown()
})

describe('TekHSI gRPC client', () => {
  it('connects, lists channels, acquires and scales a waveform, then disconnects', async () => {
    const c = await connect('127.0.0.1', port)
    expect(c.channels).toEqual(['ch1', 'ch2'])
    expect(c.protocolVersion).toBe(200)
    expect(c.capabilities).toBe(3)

    const r = await acquire(['ch1'], { maxPoints: 1000 })
    expect(r.errors).toEqual([])
    expect(r.channels).toHaveLength(1)
    const ch = r.channels[0]
    expect(ch.name).toBe('ch1')
    expect(ch.points).toBe(4)
    expect(ch.dt).toBeCloseTo(1e-6, 12)
    expect(ch.triggerIndex).toBe(1)
    expect(ch.ySpacing).toBe(0.5)
    expect(ch.yOffset).toBe(-1)
    expect(ch.y).toEqual([-1, 49, -51, 99])
    expect(status().connected).toBe(true)

    const forced = await acquire(['ch1'], { forceSequence: true })
    expect(forced.errors).toEqual([])
    expect(newSequenceCalls).toBe(1)

    await disconnect()
    expect(status().connected).toBe(false)
  })
})
