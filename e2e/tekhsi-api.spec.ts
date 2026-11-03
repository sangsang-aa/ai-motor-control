import { test, expect } from '@playwright/test'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'node:path'

const PROTO = path.join(process.cwd(), 'lib/tekhsi/TekHighspeedServer.proto')

let server: grpc.Server
let port = 0

function int16Bytes(values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 2)
  values.forEach((v, i) => buf.writeInt16LE(v, i * 2))
  return buf
}

test.beforeAll(async () => {
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
    Connect: (_call: any, cb: any) => cb(null, { status: 1, protocol_version: 200, capabilities: 3 }),
    Disconnect: (_call: any, cb: any) => cb(null, { status: 1 }),
    RequestNewSequence: (_call: any, cb: any) => cb(null, { status: 1 }),
    RequestAvailableNames: (_call: any, cb: any) => cb(null, { status: 1, symbolnames: ['CH1', 'CH2'] }),
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
      call.write({ status: 1, headerordata: { chunk: { data: int16Bytes([0, 100, -100, 200]) } } })
      call.end()
    }
  })

  port = await new Promise<number>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, p) =>
      err ? reject(err) : resolve(p)
    )
  })
})

test.afterAll(async () => {
  server.forceShutdown()
})

test('POST /api/tekhsi 走真实路由连接 fake gRPC 示波器并采集', async ({ request }) => {
  const connected = await request.post('/api/tekhsi', {
    data: { action: 'connect', host: '127.0.0.1', port }
  })
  expect(connected.ok()).toBeTruthy()
  const connectJson = await connected.json()
  expect(connectJson.channels).toEqual(['ch1', 'ch2'])
  expect(connectJson.protocolVersion).toBe(200)

  const acquired = await request.post('/api/tekhsi', {
    data: { action: 'acquire', channels: ['ch1'], maxPoints: 1000 }
  })
  expect(acquired.ok()).toBeTruthy()
  const a = await acquired.json()
  expect(a.errors).toEqual([])
  expect(a.channels).toHaveLength(1)
  expect(a.channels[0].y).toEqual([-1, 49, -51, 99])

  const disconnected = await request.post('/api/tekhsi', {
    data: { action: 'disconnect' }
  })
  expect(disconnected.ok()).toBeTruthy()
})

test('POST /api/tekhsi 拒绝非法地址', async ({ request }) => {
  const res = await request.post('/api/tekhsi', {
    data: { action: 'connect', host: 'bad host', port: 5000 }
  })
  expect(res.status()).toBe(400)
  const json = await res.json()
  expect(json.error).toContain('地址不合法')
})
