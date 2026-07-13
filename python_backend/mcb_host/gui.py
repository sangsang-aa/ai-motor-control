"""pyqtgraph live GUI: rolling telemetry plots + speed / start-stop controls."""
from __future__ import annotations

import numpy as np
import pyqtgraph as pg
from pyqtgraph.Qt import QtCore, QtWidgets

from .config import RX_CHANNELS, SERIAL, SerialCfg
from .serial_link import SerialLink

_PEN = [(0, 170, 255), (255, 140, 0), (0, 200, 120), (230, 60, 60)]
_BUF = 6000          # samples kept per channel
_UI_MS = 30          # plot refresh period


class HostWindow(QtWidgets.QMainWindow):
    def __init__(self, cfg: SerialCfg | None = None) -> None:
        super().__init__()
        self.cfg = cfg or SERIAL
        self.link = SerialLink(self.cfg)
        self.setWindowTitle("mcb_open_loop_control - Python host")
        self.resize(1000, 720)

        self._bufs = [np.zeros(_BUF) for _ in RX_CHANNELS]
        self._filled = 0

        self._build_ui()

        self._timer = QtCore.QTimer(self)
        self._timer.timeout.connect(self._update)
        self._timer.start(_UI_MS)

    # --- UI ------------------------------------------------------------------
    def _build_ui(self) -> None:
        central = QtWidgets.QWidget()
        self.setCentralWidget(central)
        root = QtWidgets.QVBoxLayout(central)

        root.addLayout(self._control_bar())

        self.glw = pg.GraphicsLayoutWidget()
        root.addWidget(self.glw, stretch=1)
        self.curves = []
        for i, ch in enumerate(RX_CHANNELS):
            p = self.glw.addPlot(row=i, col=0)
            p.showGrid(x=True, y=True, alpha=0.3)
            p.setLabel("left", ch.name, units=ch.unit)
            if i == len(RX_CHANNELS) - 1:
                p.setLabel("bottom", "sample")
            self.curves.append(p.plot(pen=pg.mkPen(_PEN[i % len(_PEN)], width=1)))

        self.status = QtWidgets.QLabel("disconnected")
        self.statusBar().addWidget(self.status)

    def _control_bar(self) -> QtWidgets.QHBoxLayout:
        bar = QtWidgets.QHBoxLayout()

        bar.addWidget(QtWidgets.QLabel("Port"))
        self.port_edit = QtWidgets.QLineEdit(self.cfg.port)
        self.port_edit.setMaximumWidth(90)
        bar.addWidget(self.port_edit)

        bar.addWidget(QtWidgets.QLabel("Baud"))
        self.baud_edit = QtWidgets.QLineEdit(str(self.cfg.baud))
        self.baud_edit.setMaximumWidth(110)
        bar.addWidget(self.baud_edit)

        self.connect_btn = QtWidgets.QPushButton("Connect")
        self.connect_btn.clicked.connect(self._toggle_connect)
        bar.addWidget(self.connect_btn)

        bar.addSpacing(20)
        bar.addWidget(QtWidgets.QLabel("Speed (RPM)"))
        self.speed_spin = QtWidgets.QSpinBox()
        self.speed_spin.setRange(-30000, 30000)
        self.speed_spin.setSingleStep(50)
        self.speed_spin.setValue(0)
        self.speed_spin.valueChanged.connect(self._send_cmd)
        bar.addWidget(self.speed_spin)

        self.motor_btn = QtWidgets.QPushButton("Start motor")
        self.motor_btn.setCheckable(True)
        self.motor_btn.toggled.connect(self._on_motor_toggle)
        bar.addWidget(self.motor_btn)

        bar.addStretch(1)
        return bar

    # --- actions -------------------------------------------------------------
    def _toggle_connect(self) -> None:
        if self.link.is_open:
            self.link.close()
            self.connect_btn.setText("Connect")
            self.status.setText("disconnected")
            return
        try:
            self.link.cfg = SerialCfg(
                port=self.port_edit.text().strip(),
                baud=int(self.baud_edit.text()),
            )
            self.link = SerialLink(self.link.cfg)
            self.link.open()
            self.connect_btn.setText("Disconnect")
            self._send_cmd()  # push current setpoint on connect
        except Exception as exc:  # noqa: BLE001
            QtWidgets.QMessageBox.critical(self, "Serial error", str(exc))

    def _on_motor_toggle(self, on: bool) -> None:
        self.motor_btn.setText("Stop motor" if on else "Start motor")
        self._send_cmd()

    def _send_cmd(self) -> None:
        self.link.send_command(self.speed_spin.value(), int(self.motor_btn.isChecked()))

    # --- plot loop -----------------------------------------------------------
    def _drain(self) -> None:
        got = False
        while True:
            try:
                frame = self.link.frames.get_nowait()
            except Exception:
                break
            got = True
            n = frame.shape[0]
            for c in range(len(self._bufs)):
                b = self._bufs[c]
                if n >= _BUF:
                    b[:] = frame[-_BUF:, c]
                else:
                    b[:-n] = b[n:]
                    b[-n:] = frame[:, c]
            self._filled = min(_BUF, self._filled + n)
        return got

    def _update(self) -> None:
        if self._drain():
            x = np.arange(self._filled)
            for c, curve in enumerate(self.curves):
                curve.setData(x, self._bufs[c][_BUF - self._filled:])
        if self.link.is_open:
            err = f"  ERR: {self.link.error}" if self.link.error else ""
            self.status.setText(
                f"{self.link.cfg.port} @ {self.link.cfg.baud}  |  "
                f"frames={self.link.frames_in}  bytes={self.link.bytes_in}"
                f"  dropped={self.link._assembler.dropped}{err}"
            )

    def closeEvent(self, ev) -> None:  # noqa: N802 (Qt signature)
        self.link.close()
        super().closeEvent(ev)


def run(cfg: SerialCfg | None = None) -> int:
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    win = HostWindow(cfg)
    win.show()
    return app.exec()
