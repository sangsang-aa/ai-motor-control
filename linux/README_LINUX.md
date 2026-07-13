# mcb_host — Linux build

Same Python code as the Windows version; only the launch scripts and the default
serial-port name differ.

## Install

```bash
cd linux
python3 -m pip install -r requirements.txt
chmod +x run.sh test.sh        # one time, after copying onto Linux
```

## Run

```bash
./run.sh                                   # default /dev/ttyUSB0 @ 5625000
./run.sh --port /dev/ttyACM0 --baud 115200 # override
```

## Offline test (no hardware)

```bash
./test.sh
```

## Linux-specific notes

- **Port name**: the LaunchPad's XDS100/FTDI bridge usually shows up as
  `/dev/ttyUSB0` (some boards: `/dev/ttyACM0`). Find it with:
  ```bash
  ls -l /dev/ttyUSB* /dev/ttyACM* ; dmesg | tail
  ```
- **Permissions**: serial access needs the `dialout` group. One time:
  ```bash
  sudo usermod -aG dialout "$USER"   # then log out / back in
  ```
- **5.625 Mbaud is non-standard.** pyserial on Linux sets custom rates via
  `termios2`/`BOTHER`, which the FTDI driver accepts. If your kernel/driver
  refuses it, fall back to a standard rate on **both** sides: launch with
  `--baud 115200` and re-flash the target SCI `UserBaudRate` to 115200.
- **GUI backend**: pyqtgraph pulls in PySide6 (Qt). On a headless box you'll need
  an X/Wayland session or `QT_QPA_PLATFORM=offscreen` for the codec/tests only.
