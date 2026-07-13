#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cli_plot.py — 命令行转速控制 + 实时波形显示
============================================
同时实现：串口电机控制 + matplotlib 实时波形
"""

import argparse
import sys
import time
import threading
import queue

import numpy as np
import serial
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

from mcb_host.config import SERIAL, TX_FIELDS, RX_CHANNELS, FRAME, SerialCfg
from mcb_host.protocol import encode_command, FrameAssembler

_PARITY = {"N": serial.PARITY_NONE, "E": serial.PARITY_EVEN, "O": serial.PARITY_ODD}
_STOP = {1: serial.STOPBITS_ONE, 2: serial.STOPBITS_TWO}

# ── 全局状态 ──────────────────────────────────────────────────────
frame_queue = queue.Queue(maxsize=500)
latest_speed = 0
motor_on = False
ser = None
running = True


def open_port(cfg: SerialCfg) -> serial.Serial:
    try:
        s = serial.Serial(
            port=cfg.port, baudrate=cfg.baud, bytesize=cfg.bytesize,
            parity=_PARITY[cfg.parity], stopbits=_STOP[cfg.stopbits],
            timeout=cfg.timeout,
        )
        time.sleep(0.05)
        return s
    except serial.SerialException as e:
        print(f"[FAIL] 无法打开 {cfg.port}: {e}")
        sys.exit(1)


def send_command(speed_rpm: float, motor_on_flag: int):
    global ser
    data = encode_command([speed_rpm, motor_on_flag], TX_FIELDS)
    try:
        ser.write(data)
        ser.flush()
    except serial.SerialException:
        pass


def rx_thread():
    """后台线程：持续读取串口数据并解帧"""
    global ser, running
    assembler = FrameAssembler(RX_CHANNELS, FRAME)
    while running:
        try:
            n = ser.in_waiting or 1
            chunk = ser.read(n)
            if chunk:
                for frame in assembler.feed(chunk):
                    try:
                        frame_queue.put_nowait(frame)
                    except queue.Full:
                        try:
                            frame_queue.get_nowait()
                            frame_queue.put_nowait(frame)
                        except queue.Empty:
                            pass
        except serial.SerialException:
            break
        except Exception:
            time.sleep(0.01)


# ── 波形数据缓冲 ──────────────────────────────────────────────────
BUF_SIZE = 30000
ia_buf = np.zeros(BUF_SIZE)
speed_buf = np.zeros(BUF_SIZE)
filled = 0


def drain_frames():
    global filled
    got = False
    while True:
        try:
            frame = frame_queue.get_nowait()
        except queue.Empty:
            break
        got = True
        n = frame.shape[0]
        # channel 0 = Ia, channel 1 = Speed
        if n >= BUF_SIZE:
            ia_buf[:] = frame[-BUF_SIZE:, 0]
            speed_buf[:] = frame[-BUF_SIZE:, 1]
            filled = BUF_SIZE
        else:
            ia_buf[:-n] = ia_buf[n:]
            ia_buf[-n:] = frame[:, 0]
            speed_buf[:-n] = speed_buf[n:]
            speed_buf[-n:] = frame[:, 1]
            filled = min(BUF_SIZE, filled + n)
    return got


def main():
    global ser, running, latest_speed, motor_on

    parser = argparse.ArgumentParser(description="电机控制 + 实时波形")
    parser.add_argument("--port", "-p", default=SERIAL.port)
    parser.add_argument("--baud", "-b", type=int, default=SERIAL.baud)
    args = parser.parse_args()

    cfg = SerialCfg(port=args.port, baud=args.baud)
    ser = open_port(cfg)

    # 启动后台接收线程
    t = threading.Thread(target=rx_thread, daemon=True)
    t.start()

    # ── 创建 matplotlib 窗口 ──────────────────────────────────────
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
    fig.suptitle(f"电机实时波形 — {cfg.port} @ {cfg.baud} bps", fontsize=13)

    ax1.set_ylabel("Ia (ADC)")
    ax1.set_ylim(0, 4000)
    ax1.grid(True, alpha=0.3)
    line_ia, = ax1.plot([], [], color='#00AAFF', linewidth=0.8, label="Ia")
    ax1.legend(loc='upper right')

    ax2.set_ylabel("Speed (RPM)")
    ax2.set_xlabel("Sample")
    ax2.set_ylim(0, 3000)
    ax2.grid(True, alpha=0.3)
    line_speed, = ax2.plot([], [], color='#FF8C00', linewidth=0.8, label="Speed")
    ax2.legend(loc='upper right')

    # 控制状态文本
    status_text = fig.text(0.02, 0.01, "Motor: OFF | Speed: 0 RPM", fontsize=10,
                           color='red', fontweight='bold')

    def update(frame):
        global filled
        drain_frames()
        if filled > 0:
            x = np.arange(filled)
            line_ia.set_data(x, ia_buf[:filled])
            line_speed.set_data(x, speed_buf[:filled])
            ax1.set_xlim(0, filled)
            ax2.set_xlim(0, filled)

        color = 'green' if motor_on else 'red'
        status = "ON" if motor_on else "OFF"
        status_text.set_text(f"Motor: {status} | Speed: {int(latest_speed)} RPM")
        status_text.set_color(color)
        return line_ia, line_speed, status_text

    ani = FuncAnimation(fig, update, interval=50, blit=False, cache_frame_data=False)

    # ── 键盘控制（通过控制台输入）──────────────────────────────────
    print()
    print("=" * 50)
    print("  电机控制 + 实时波形")
    print("=" * 50)
    print("  在弹出的 matplotlib 窗口查看波形")
    print("  在此控制台输入转速: 3000 / -500 / 0 / stop / q")
    print("=" * 50)
    print()

    def input_thread():
        global latest_speed, motor_on, running
        while running:
            try:
                line = input("转速> ").strip()
            except (EOFError, KeyboardInterrupt):
                running = False
                break
            if not line:
                continue
            low = line.lower()
            if low in ("q", "quit", "exit"):
                running = False
                break
            elif low == "stop":
                motor_on = False
                latest_speed = 0
                send_command(0, 0)
                print("  → motor=OFF")
            elif low == "start":
                motor_on = True
                send_command(latest_speed, 1)
                print(f"  → motor=ON, speed={int(latest_speed)} RPM")
            else:
                try:
                    speed = float(line)
                    latest_speed = speed
                    motor_on = (speed != 0)
                    send_command(speed, int(motor_on))
                    print(f"  → speed={int(speed)} RPM  motor={'ON' if motor_on else 'OFF'}")
                except ValueError:
                    print(f"  [ERR] 无效输入: '{line}'")

    input_t = threading.Thread(target=input_thread, daemon=True)
    input_t.start()

    try:
        plt.show()
    except KeyboardInterrupt:
        pass
    finally:
        running = False
        send_command(0, 0)
        time.sleep(0.05)
        if ser and ser.is_open:
            ser.close()
        print("\n串口已关闭。")


if __name__ == "__main__":
    main()
