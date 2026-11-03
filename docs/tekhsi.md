# TekHSI 网口示波器（Tektronix 4/5/6 系 MSO）

`/net-scope` 通过 **Tektronix High-Speed Interface (TekHSI)** 从示波器采集波形。
TekHSI 是 **gRPC over Ethernet**，默认 `host:5000`（明文），不是 VXI-11/SCPI。

## 前置条件

- Tektronix **4/5/6 系 MSO**，固件支持并已启用 TekHSI 服务。
- 运行 `next start`（或 `next dev`）的机器能访问示波器 IP，端口 `5000` 可达。
- 示波器已完成采集（STOP 或 RUN 均可；`WaitForDataAccess` 会等待可用数据）。
- 第一版只支持**模拟通道单帧**；数字通道 / IQ / FastFrame 会返回明确错误。

浏览器不能直接开 gRPC/TCP，所以链路是：

```
浏览器 /net-scope
  ↕ 同源 HTTP (POST /api/tekhsi)
Next.js Node 路由
  ↕ gRPC :5000
Tektronix scope
```

## 协议与代码位置

| 文件 | 职责 |
|---|---|
| `lib/tekhsi/TekHighspeedServer.proto` | 官方 Python 包序列化描述符还原的 proto（package `Tekscope`） |
| `lib/tekhsi/client.ts` | gRPC 单例、连接/采集时序、错误映射（server-only） |
| `lib/tekhsi/decode.ts` | 原始采样 → 工程值、时间轴、抽点 |
| `lib/tekhsi/csv.ts` | 长格式 CSV |
| `lib/tekhsi/types.ts` | 前后端共享类型 |
| `app/api/tekhsi/route.ts` | HTTP 契约（Node runtime） |
| `components/net-scope/` | 页面、连接/通道/采集、SVG 波形、元数据 |

服务：

- `Connect`
  - `Connect` / `Disconnect` / `RequestNewSequence`
  - `RequestAvailableNames`
  - `WaitForDataAccess` / `FinishedWithDataAccess`
- `NativeData`
  - `GetHeader`（返回 `RawReply.headerordata.header`）
  - `GetWaveform`（server-stream，返回 `chunk.data` 原始字节）
- `NormalizedData`（本实现未用；官方 Python 客户端也用 `NativeData` + 自行缩放）

## 采集时序

```
Connect {name}
RequestAvailableNames {name}          → symbolnames（转小写，如 ch1）
[RequestNewSequence {name}]           → 可选：强制新采集
WaitForDataAccess {name}              → 阻塞到示波器允许访问
  for each channel:
    GetHeader {sourcename, chunksize=80000}
    GetWaveform {sourcename, chunksize=80000}  (stream)
FinishedWithDataAccess {name}
```

- `name` 是每次连接生成的 UUID（`mototune-<uuid>`）。
- `GetHeader` 在刚拿到访问权时可能暂时为空；实现会重试 6 次 × 100ms。
- `FinishedWithDataAccess` 放在 `finally`，即使某个通道失败也会释放访问权。
- 每次 `acquire` 只调用一次 `WaitForDataAccess`，多通道共享同一次数据访问窗口。

## 波形解码

与官方 Python `tm_data_types` 的 `AnalogWaveform.normalized_vertical_values` 一致：

| `sourcewidth` | dtype |
|---|---|
| 1 | `int8` |
| 2 | `int16` little-endian |
| 4 | `float32` little-endian |

```
y[i] = raw[i] * header.verticalspacing + header.verticaloffset
x[i] = (i - header.horizontalzeroindex) * header.horizontalspacing
```

- 支持 `wfmtype` 1/2/3（ANALOG_8 / ANALOG_16 / ANALOG_FLOAT）。
- 数字/IQ（4/5/6/7）返回「不是模拟通道」错误。
- 默认最多返回 100000 点/通道；超过时按 `stride = ceil(N / maxPoints)` 抽点，界面显示 `×N`，CSV 时间轴按原索引计算。
- `GetHeader` 的 `noofsamples` 用于截断多余字节（防止流末尾补零）。

## HTTP 契约

`POST /api/tekhsi`

```jsonc
// 连接
{ "action": "connect", "host": "192.168.0.1", "port": 5000 }
// → { host, port, protocolVersion, capabilities, channels: ["ch1","ch2"] }

// 采集
{ "action": "acquire", "channels": ["ch1","ch2"], "forceSequence": false, "maxPoints": 100000 }
// → { capturedAt, channels: TekChannel[], errors: [{name,error}] }

// 断开
{ "action": "disconnect" }
// → { ok: true }
```

`GET /api/tekhsi` → 当前连接状态。

`TekChannel`：

```ts
{
  name: string; yUnits: string; xUnits: string;
  dt: number; triggerIndex: number;
  ySpacing: number; yOffset: number;
  points: number; samples: number; stride: number;
  y: number[];   // 已缩放（抽点后）
}
```

校验：`host` 仅允许 IPv4/主机名；`port` 1–65535；通道 1–8 个且匹配 `^[a-zA-Z0-9_.-]{1,64}$`；`maxPoints` 1000–1000000。

## 页面使用

1. 打开侧栏「网口示波器」`/net-scope`。
2. 填示波器 IP（默认 `192.168.0.1`），端口 `5000`，点「连接」。
3. 勾选通道（默认前两个）。
4. 「单次采集」；需要刷新时开「连续采集（1 Hz）」。
5. 「导出 CSV（长格式）」：`channel,time_s,value`，不同时基/长度也可直接导出。

「强制新采集」会先调用 `RequestNewSequence`，适合示波器处于 STOP、但想强制取一帧的场景。

## 限制

- 不支持 SCPI 仪器控制（时基/触发/垂直档位）；TekHSI 只负责数据。
- 不支持 TLS / Mode 3 认证；当前为官方示例的明文 `:5000`。
- 不支持数字通道、IQ、FastFrame。
- 连续采集是 1 Hz 轮询，不是示波器内部的高速流式触发。
- 单次响应包含全部采样点（默认上限 10 万/通道），大记录会占内存/网络。

## 实机验收清单

- [ ] 示波器型号为 4/5/6 系 MSO，TekHSI 已启用。
- [ ] 运行 Next 的机器 `ping` 示波器 IP 成功，`5000` 端口可达。
- [ ] `/net-scope` 连接后能看到真实通道名（ch1…）。
- [ ] 单次采集的波形与示波器屏幕一致（幅值/时间轴/触发位置）。
- [ ] 连续采集 10 帧无泄漏/超时；断开后示波器可继续正常采集。
- [ ] 导出 CSV 用 Excel/Python 打开，时间轴与幅值单位正确。

## 测试

```bash
npx vitest run unit/tekhsiDecode.spec.ts unit/tekhsiClient.spec.ts
npx playwright test e2e/net-scope.spec.ts e2e/tekhsi-api.spec.ts
```

- `tekhsiDecode`：int8/int16/float32、缩放、时间轴、抽点、CSV。
- `tekhsiClient`：`// @vitest-environment node` 起 fake gRPC server，走完整时序。
- `net-scope`：mock `/api/tekhsi` 验证 UI/CSV/连续采集。
- `tekhsi-api`：真实 `/api/tekhsi` + fake gRPC server，验证路由契约。
- 浏览器 mock 不能替代实机验收。

## 安全说明

`/api/tekhsi` 会向用户输入的 `host:port` 发起 TCP 连接。仅建议在本机/实验室网络使用，不要把该路由暴露到公网（存在 SSRF 风险）。如需公网部署，应增加 allowlist / 网络隔离 / 认证。
