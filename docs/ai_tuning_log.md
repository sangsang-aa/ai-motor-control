# AI 控制参数调优记录

> 用途:记录每台设备在选定控制算法下的参数快照与对应转速响应,供 AI 学习"参数 → 控制效果"关系,从而自动优化控制思路。
> 标注方式:全部按 **Modbus 设备码**(保持寄存器/线圈地址)标注,与 `docs/modbus_rtu_protocol.md`、`lib/serial/modbus.ts` 保持一致。
> 填写时机:每次修改控制参数并完成一次转速实验后,按下方模板追加一条记录。

---

## 1. Modbus 设备码速查表(参数 → 地址 → 含义)

### 保持寄存器(Holding Register)

| 地址 | 寄存器号 | 名称 | 含义 | 写入方式 |
|---|---|---|---|---|
| 0x0000 | 40001 | `SPEED_SETPOINT` | 目标转速 0~6000 RPM | 06/10 |
| 0x0001 | 40002 | `CONTROL_MODE` | 控制算法:0=PID,≥1=预留其他算法 | 06/10 |
| 0x0100 | 40257~40258 | `PID_SPD_KP` | 速度环比例 Kp (f32) | 10 |
| 0x0102 | 40259~40260 | `PID_SPD_KI` | 速度环积分 Ki (f32) | 10 |
| 0x0104 | 40261~40262 | `PID_SPD_KD` | 速度环微分 Kd (f32) | 10 |
| 0x0106 | 40263~40264 | `PID_SPD_KD_N` | 速度环微分滤波系数 (f32) | 10 |
| 0x0108 | 40265~40266 | `PID_SPD_KI_UPLIM` | 速度环抗饱和积分上限 (f32) | 10 |
| 0x010A | 40267~40268 | `PID_SPD_KI_LOWLIM` | 速度环抗饱和积分下限 (f32) | 10 |
| 0x010C | 40269~40270 | `PID_SPD_KI_OUT_LIM` | 速度环积分限幅 (f32) | 10 |
| 0x010E | 40271~40272 | `PID_SPD_OUT_LIM` | 速度环输出限幅 (f32) | 10 |
| 0x0110 | 40273~40274 | `PID_CUR_KP` | 电流环比例 Kp (f32) | 10 |
| 0x0112 | 40275~40276 | `PID_CUR_KI` | 电流环积分 Ki (f32) | 10 |
| 0x0114 | 40277~40278 | `PID_CUR_KD` | 电流环微分 Kd (f32) | 10 |
| 0x0116 | 40279~40280 | `PID_CUR_KD_N` | 电流环微分滤波系数 (f32) | 10 |
| 0x0118 | 40281~40282 | `PID_CUR_KI_UPLIM` | 电流环抗饱和积分上限 (f32) | 10 |
| 0x011A | 40283~40284 | `PID_CUR_KI_LOWLIM` | 电流环抗饱和积分下限 (f32) | 10 |
| 0x011C | 40285~40286 | `PID_CUR_KI_OUT_LIM` | 电流环积分限幅 (f32) | 10 |
| 0x011E | 40287~40288 | `PID_CUR_OUT_LIM` | 电流环输出限幅 (f32) | 10 |
| 0x1000 | 41057~41058 | `ACTUAL_SPEED` | 实际转速 (f32, 只读) | 03 |
| 0x1002 | 41059~41060 | `ACTUAL_CURRENT` | 实际电流 (f32, 只读) | 03 |
| 0x1004 | 41061 | `FAULT_CODE` | 故障码 (u16, 只读) | 03 |
| 0x1005 | 41062 | `STATUS_FLAGS` | 状态位 (u16, 只读) | 03 |

### 线圈(Coil,独立地址空间)

| 地址 | 线圈编号 | 名称 | 含义 | 写入方式 |
|---|---|---|---|---|
| 0x0000 | 00001 | `COIL_MOTOR_EN` | 电机使能:1 启动 / 0 停止 | 05/0F |
| 0x0001 | 00002 | `COIL_FAULT_RESET` | 故障复位(写 1 触发) | 05/0F |
| 0x0002 | 00003 | `COIL_EMERGENCY_STOP` | 急停输出 | 05/0F |

> float32 参数占 2 寄存器,big-endian(高字在低地址)。读取状态量用 `03` 功能码;写参数用 `06`/`10`;开关用 `05`/`0F`。

---

## 2. 调参记录模板(每次调参一条,追加到第 3 节)

```text
### 记录 #<编号>
- 时间: <YYYY-MM-DD HH:MM>
- 设备: 从站地址 <0x01>  | 端口 <USB:xxxx:xxxx>
- 控制算法 CONTROL_MODE(0x0001): <0=PID / >=1 其他>
- 电机使能 COIL_MOTOR_EN(0x0000): <1/0>

[ 参数快照(当前设备当前算法的完整值,未改动项照抄) ]
速度环 SPD:
- PID_SPD_KP(0x0100): <值>   ← 本次修改的打 * 标记
- PID_SPD_KI(0x0102): <值>
- PID_SPD_KD(0x0104): <值>
- PID_SPD_KD_N(0x0106): <值>
- PID_SPD_KI_UPLIM(0x0108): <值>
- PID_SPD_KI_LOWLIM(0x010A): <值>
- PID_SPD_KI_OUT_LIM(0x010C): <值>
- PID_SPD_OUT_LIM(0x010E): <值>
电流环 CUR:
- PID_CUR_KP(0x0110): <值>
- PID_CUR_KI(0x0112): <值>
- PID_CUR_KD(0x0114): <值>
- PID_CUR_KD_N(0x0116): <值>
- PID_CUR_KI_UPLIM(0x0118): <值>
- PID_CUR_KI_LOWLIM(0x011A): <值>
- PID_CUR_KI_OUT_LIM(0x011C): <值>
- PID_CUR_OUT_LIM(0x011E): <值>

[ 实验与结果 ]
- 目标转速 SPEED_SETPOINT(0x0000): <值> RPM
- 实际转速 ACTUAL_SPEED(0x1000): <稳态值> RPM
- 实际电流 ACTUAL_CURRENT(0x1002): <值> A
- 故障码 FAULT_CODE(0x1004): <0=无故障>
- 响应指标: 超调 <x>% | 调节时间 <x>s | 稳态误差 <x> RPM
- 备注/效果评估: <如:响应更快但波动增大;超调减少;稳定;需进一步调 > 
```

---

## 3. 历史调参记录(AI 学习语料)

<!-- 按上面模板在下方追加。记录越多,AI 对"参数 → 转速响应"的映射越准。 -->

### 记录 #001
- 时间: (待填)
- 设备: 从站地址 0x01
- 控制算法 CONTROL_MODE: 0 (PID)
- 电机使能 COIL_MOTOR_EN: 1
- 速度环 SPD: Kp=..  Ki=..  Kd=..  Kd_N=..  KI_UPLIM=..  KI_LOWLIM=..  KI_OUT_LIM=..  OUT_LIM=..
- 电流环 CUR: Kp=..  Ki=..  Kd=..  Kd_N=..  KI_UPLIM=..  KI_LOWLIM=..  KI_OUT_LIM=..  OUT_LIM=..
- 目标转速 SPEED_SETPOINT: .. RPM
- 实际转速 ACTUAL_SPEED: .. RPM
- 实际电流 ACTUAL_CURRENT: .. A
- 故障码 FAULT_CODE: 0
- 响应: 超调 ..% / 调节 ..s / 稳态误差 .. RPM
- 备注: ..

---

## 4. AI 学习与应用说明

- **数据用途**:每条记录提供 `(设备, 算法, 参数快照, 目标转速, 实际转速, 响应指标)` 的完整映射,是参数寻优与故障归因的训练语料。
- **写入方式统一走设备码**:AI 生成调参命令时使用上述 Modbus 地址(如 `write_pid_PID_SPD_KP` → 0x0100),避免语义歧义。
- **调参建议链路**:AI 依据历史记录,给出下一组 PID 参数 → 通过 `CONTROL_MODE` 选定算法 → 写对应寄存器 → 记录本轮结果 → 追加到本表,形成闭环。
- **安全约束**:转速 0~6000 RPM;急停用 `COIL_EMERGENCY_STOP(0x0002)`;`COIL_MOTOR_EN(0x0000)` 控制启停。任何 AI 建议不得越权修改波特率/固件参数。
