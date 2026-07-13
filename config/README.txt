AI 电驱控制系统 — ARM64 版本配置说明
=======================================

## 系统依赖
sudo apt install -y libnss3 libnspr4 libasound2t64
sudo apt install -y python3 python3-pip
pip install numpy pyserial

## 串口权限
sudo usermod -aG dialout $USER
# ARM 平台常见串口设备：
#   /dev/ttyAMA0  (树莓派主串口)
#   /dev/ttyS0    (SoC 原生串口)
#   /dev/ttyUSB0  (USB 转串口，与 x86 相同)
#   /dev/ttyACM0  (USB CDC ACM)
ls /dev/tty* | head -20  # 查看可用串口

## LLM 配置
编辑 config/llm_config.yaml，填入阿里云百炼 API Key

## 启动
./run.sh

## ARM 平台注意事项
- 默认端口 /dev/ttyUSB0 — 若使用 SoC 原生串口，需改为 /dev/ttyAMA0 或 /dev/ttyS0
- 某些 ARM SoC 的 UART 波特率上限可能低于 5625000，请查阅芯片手册
- NVIDIA Jetson 平台串口设备名通常为 /dev/ttyTHS0 或 /dev/ttyUSB0
- 如 pyserial 安装报错，确认已安装 python3-dev: sudo apt install python3-dev
