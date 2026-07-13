#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cli_control.py — 命令行转速控制（复用 mcb_host 协议栈）
======================================================
直接输入转速数值，通过串口发送给 F28069M 电机驱动器。
不依赖 Gemma AI，不依赖 Qt GUI。

用法:
    python3 cli_control.py                  # 交互模式，逐条输入转速
    python3 cli_control.py 3000             # 单次：启动电机，转速 3000 RPM
    python3 cli_control.py 0                # 单次：停止电机
    python3 cli_control.py --port /dev/ttyUSB0 --baud 115200

输入格式:
    3000      → 转速 3000 RPM，自动启动电机
    -500      → 反向 500 RPM
    0         → 停止电机
    start     → 以上次转速启动
    stop      → 停止电机
    q / quit  → 退出
"""

import argparse
import sys
import time

# ── 复用 mcb_host 的配置和协议编码 ────────────────────────────────
from mcb_host.config import SERIAL, TX_FIELDS, SerialCfg
from mcb_host.protocol import encode_command

# pyserial 直接操作，不走 SerialLink 的线程模型（CLI 不需要）
import serial as _serial


_PARITY = {"N": _serial.PARITY_NONE, "E": _serial.PARITY_EVEN, "O": _serial.PARITY_ODD}
_STOP = {1: _serial.STOPBITS_ONE, 2: _serial.STOPBITS_TWO}


def open_port(cfg: SerialCfg) -> _serial.Serial:
    """打开串口，失败则打印诊断并退出。"""
    try:
        ser = _serial.Serial(
            port=cfg.port,
            baudrate=cfg.baud,
            bytesize=cfg.bytesize,
            parity=_PARITY[cfg.parity],
            stopbits=_STOP[cfg.stopbits],
            timeout=cfg.timeout,
        )
        time.sleep(0.05)
        return ser
    except _serial.SerialException as e:
        print(f"[FAIL] 无法打开 {cfg.port}: {e}")
        print()
        print("排查:")
        print(f"  1. 设备是否存在:  ls -la {cfg.port}")
        print("  2. 是否在 dialout 组: groups")
        print("  3. 是否被其他程序占用: lsof", cfg.port)
        sys.exit(1)
    except ValueError as e:
        print(f"[FAIL] 参数无效 (可能是波特率 {cfg.baud} 不被支持): {e}")
        print("  试试: python3 cli_control.py --baud 115200")
        sys.exit(1)


def send(ser: _serial.Serial, speed_rpm: float, motor_on: int) -> bool:
    """发送一条指令，返回是否成功。"""
    data = encode_command([speed_rpm, motor_on], TX_FIELDS)
    try:
        n = ser.write(data)
        ser.flush()
        return n == len(data)
    except _serial.SerialException as e:
        print(f"[ERR] 写入失败: {e}")
        return False


def show_response(ser: _serial.Serial) -> None:
    """打印串口收到的原始字节（调试用）。"""
    waiting = ser.in_waiting
    if waiting > 0:
        raw = ser.read(waiting)
        hex_str = " ".join(f"{b:02x}" for b in raw)
        print(f"  ← 收到 {waiting} 字节: [{hex_str}]")


def interactive(ser: _serial.Serial) -> None:
    """交互模式：逐条输入转速。"""
    last_speed = 0
    motor_on = False

    print()
    print("=" * 50)
    print(f"  电机转速控制 — {ser.port} @ {ser.baudrate} bps")
    print("=" * 50)
    print("  输入转速 (RPM)，例如: 3000")
    print("  输入 0 / stop 停止, start 重新启动, q 退出")
    print("=" * 50)
    print()

    while True:
        try:
            line = input("转速> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n退出...")
            break

        if not line:
            continue

        low = line.lower()
        if low in ("q", "quit", "exit"):
            break
        elif low == "stop":
            motor_on = False
        elif low == "start":
            motor_on = True
        else:
            try:
                last_speed = float(line)
                motor_on = (last_speed != 0)
            except ValueError:
                print(f"  [ERR] 无效输入: '{line}' — 请输入数字转速或 start/stop/q")
                continue

        status = "ON " if motor_on else "OFF"
        ok = send(ser, last_speed if motor_on else 0, int(motor_on))
        if ok:
            speed_display = int(last_speed) if motor_on else 0
            print(f"  → speed={speed_display:6d} RPM  motor={status}  [OK]")
        else:
            print(f"  → speed={int(last_speed):6d} RPM  motor={status}  [FAIL]")

        show_response(ser)


def one_shot(ser: _serial.Serial, speed_rpm: float) -> None:
    """单次指令模式。"""
    motor_on = int(speed_rpm != 0)
    ok = send(ser, speed_rpm, motor_on)
    status = "ON" if motor_on else "OFF"
    if ok:
        print(f"→ speed={int(speed_rpm)} RPM  motor={status}  [OK]")
    else:
        print(f"→ speed={int(speed_rpm)} RPM  motor={status}  [FAIL]")
        sys.exit(1)
    show_response(ser)


def main():
    parser = argparse.ArgumentParser(
        description="命令行电机转速控制 (基于 mcb_host 协议)"
    )
    parser.add_argument(
        "speed", nargs="?", type=float, default=None,
        help="转速 (RPM)，省略则进入交互模式"
    )
    parser.add_argument(
        "--port", "-p", default=SERIAL.port,
        help=f"串口设备 (默认: {SERIAL.port})"
    )
    parser.add_argument(
        "--baud", "-b", type=int, default=SERIAL.baud,
        help=f"波特率 (默认: {SERIAL.baud})"
    )
    args = parser.parse_args()

    cfg = SerialCfg(port=args.port, baud=args.baud)
    ser = open_port(cfg)

    try:
        if args.speed is not None:
            one_shot(ser, args.speed)
        else:
            interactive(ser)
    finally:
        # 安全收尾：停止电机 + 关闭串口
        send(ser, 0, 0)
        time.sleep(0.05)
        ser.close()
        print("串口已关闭。")


if __name__ == "__main__":
    main()
