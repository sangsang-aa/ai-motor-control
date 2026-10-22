# AI-Motor v1 串口协议(MOTOTUNE Web)

> 上位机(Web)与下位机(TI C2000 F280025C,AI-Motor v1 从站)之间的串口协议。
> 实现:`lib/serial/aimotor/protocol.ts`(帧/CRC/编解码)、`controller.ts`(Web Serial/握手/重试)、`params.ts`(参数表/安全锁)。
> 来源:实测上位机 `AI-Motor`(Python)的 `通信协议.txt` / `protocol.py`;参数表来自 `parameters.json`,需与固件 `host_parameters.inc` 对齐。

## 1. 物理层

- SCI-A,**115200 baud**,8N1,无流控;上位机通过 Web Serial 直连。
- 固件侧实际波特率可能因 LSPCLK/BRR 略低于 115200(以固件为准),上位机按 115200 配置。
- 端口打开后尝试 `DTR=false` 并等待 100ms;USB-TTL 适配器不支持时忽略,不阻塞连接。

## 2. 帧格式

```
A5 5A | version:u8=1 | type:u8 | payload_len:u16LE | seq:u16LE | payload | CRC16:u16LE
```

- CRC16/CCITT-FALSE:初值 `FFFF`,多项式 `1021`,无反射、无末尾异或。
- 计算范围:`version` 至 `payload` 末尾(不含 `A5 5A`、不含 CRC)。
- 浮点 IEEE-754 binary32 **小端**;整数无符号小端。
- 最大帧 128 wire 字节,数据区 ≤118。

## 3. 消息类型

| type | 名称 | payload | 说明 |
|---|---|---|---|
| `0x01` | 命令 | 8B:`command:u8 mode:u8 param:u16LE value:f32LE` | 上位机 → 下位机 |
| `0x81` | ACK | 8B:`command:u8 status:u8 param:u16LE value:f32LE` | 回显请求 seq |
| `0x80` | 快速遥测 | 60B:`tick:u32 mode:u16 stage:u16 flags:u16 error:u16` + 12×f32 | 默认 10ms |
| `0x82` | 模型/诊断 | 76B:`10×f32 + 8×u16 + 5×u32` | 默认 100ms |
| `0x83` | 配置回读 | 每记录 8B:`param:u16 mode:u8 integer:u8 value:f32` | ≤4 条/帧 |

### 快速遥测 12×f32

`reference_rpm, measured_rpm, id_applied_a, id_measured_a, iq_applied_a, iq_measured_a, iu, iv, iw, angle_rad, emf_magnitude_v, if_speed_rpm`

- mode7:`reference/speed/angle/iq_ref/if_speed=0`,`id_ref=dc_target`;`error` 为 `MotorIdentError`。
- `flags` 位:0 enable、1 active、2 injection、3 BEMF valid、4 速度环锁存、5 电气模型可用、6 原生 HFI 可用、7 远程所有权、8 通信超时曾停机。

### 模型 76B

- 10×f32:`Rs, Ld, Lq, Ls, bandwidth, Kp_d, Ki_d, Kp_q, Ki_q, bus_voltage`。
- 8×u16:`pole_pairs, status, hfi_status, select, applied, save_status, saved_valid, ident_error`。
- 5×u32:`applied_revision, rx_frames, crc_errors, dropped_samples, sci_errors`。

## 4. 命令

| command | 名称 | 说明 |
|---|---|---|
| 0 | HEARTBEAT | 100ms 心跳,不回 ACK |
| 1 | STOP | 立即撤销所有模式使能/进入 mode5 |
| 2 | SET_MODE | 仅 5/6/7/8;运行中切换被拒绝 |
| 3 | SET_PARAM | `mode=0` 全局;6/8 启动实例;7 辨识 |
| 4 | ENABLE | 使能选定模式(必须先 HELLO) |
| 5 | GET_CONFIG | 请求全部允许参数回读 |
| 6 | HELLO | 建立会话 |

ACK status:`0` 成功、`1` 未知命令、`2` 模式错误、`3` 参数错误、`4` 越界/非法、`5` 运行中禁止、`6` 模型/HFI 不可用、`7` 忙、`8` 未握手、`9` 心跳超时。

## 5. 模式

| mode | 名称 |
|---|---|
| 5 | 停止 / 空闲 |
| 6 | HFI → I/f → 速度环 |
| 7 | 电机参数辨识(Rs/Ld/Lq/Ls) |
| 8 | Id 对齐 → I/f → 速度环 |

## 6. 安全与会话

- HELLO 成功后 100ms 心跳;单命令在途;丢 ACK 同 seq 重发,最多 2 次(每次 300ms);STOP 优先。
- 5s 无有效下位机数据 → 上位机判超时;MCU 端 500ms 心跳看门狗撤销远程使能。
- 转速上限 6000 RPM(clamp,项目安全约束)。
- AI 工具禁止修改安全锁定参数:`6` 强拖上限、`13` 闭环最大 Iq、`24` 闭环 Iq 范围上限、`42` 辨识最大测试电流、`51` 参数组、`52` 自动应用。
- 参数辨识页的人工写入走 `sendManualParam`(不受 AI 锁限制,但仍做范围校验)。

## 7. 参数表

允许参数表见 `lib/serial/aimotor/params.ts`(30 条:目标转速、启动/速度环/交接/对齐/辨识/全局)。
参数 ID 不是内存地址;写入前必须做范围/整数/上限跟随校验。
