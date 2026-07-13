# 问题修复说明

串口状态不一致修复：将串口 connected 状态从 Python 后端经主进程唯一维护，广播给所有 Renderer。图表窗口不再自行判断连接状态。断开操作强制穿透到 pyserial close()。

手动连接与波特率：从自动连接改为完全手动。未连接时用户可编辑端口与波特率，点击连接后才建立物理链路；连接后参数锁定，必须先断开再改值。

指令竞态修复：引入 commandLock 机制。存在 pending 或 executing 的控制指令时，Composer 完全锁定，用户无法提交新消息，LLM 侧也被阻止发起新的 toolCall，彻底杜绝上一个命令未执行就开始下一个的问题。

防卡死修复：主进程 LLM 调用全面异步化，采用 fetch ReadableStream 流式解析。Python 后端改为多线程，串口读写独占线程且设置 write_timeout。前端流式输出使用 requestAnimationFrame 合并更新。增加 Python 后端心跳检测，僵死时自动重启。
