# COMMENTS
## 1. 算法参数调整（xxx 对应 CUR, SPD) 
----
将FOC区块删除，PID综合为一块，但是里面分为速度环和电流环
----
PID_xxx_KP,PID_xxx_KI,PID_xxx_KD: KP, KI, Kd

PID_xxx_KD_N: 微分环节滤波器系数

PID_xxx_KI_UPLIM: 抗饱和积分上限

PID_xxx_KI_LOWLIM: 抗饱和积分下限

PID_xxx_KI_OUT_LIM: 积分限幅

PID_xxx_OUT_LIM: 输出限幅

## 2 新增 Coil 分表存储开关信号
----
将保持寄存器 全局控制区 中的开关分离改为 线圈储存
----
每个 Coil 使用 1bit 存储开关/布尔信号，Coil线圈定义（独立位地址空间，0‑based PDU偏移）

功能码：01读线圈、05写单线圈、0F(15)写多线圈（多个设备控制）。
存储：DSP固件内部使用uint8_t字节数组，每字节存放8个线圈；字节内bit0对应最低线圈地址(LSB优先)。
⚠️Coil地址空间与保持寄存器PDU地址完全独立，Coil 0x0000 ≠ HoldingRegister 0x0000。

Coil PDU偏移	线圈编号	名称	读写	描述
0x0000	00001	COIL_MOTOR_EN	R/W	电机使能：1启动，0停止
0x0001	00002	COIL_FAULT_RESET	R/W	故障复位，写1触发脉冲
0x0002	00003	COIL_EMERGENCY_STOP	R/W	急停输出
0x0004 ~ 0x001F	00005‑00032	RESERVED_COIL	R/W	预留29路开关输出(共32个线圈，占用4字节uint8数组)

## 3.精度确认

按照你之前写的用float即可

## 4.协议文档

写一份标准的协议文档方便使用者理解