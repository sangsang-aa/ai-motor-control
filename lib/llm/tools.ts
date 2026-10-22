// LLM 工具定义 + 系统提示词 — 前后端共用(route.ts 服务端使用,前端展示用)

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'set_speed',
      description: '设置电机目标转速 0~6000 RPM(超限拒绝)',
      parameters: {
        type: 'object',
        properties: { rpm: { type: 'integer', minimum: 0, maximum: 6000 } },
        required: ['rpm']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_motor_state',
      description: '启动或停止电机。true=先选 mode6/8 再 ENABLE;false=立即 STOP',
      parameters: {
        type: 'object',
        properties: { on: { type: 'boolean' } },
        required: ['on']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_mode',
      description: '切换运行模式:5 停止/空闲,6 HFI→I/f→速度环,7 参数辨识,8 Id对齐→I/f→速度环。运行中切换会被下位机拒绝',
      parameters: {
        type: 'object',
        properties: { mode: { type: 'integer', enum: [5, 6, 7, 8] } },
        required: ['mode']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_param',
      description: '写允许参数(参数 ID 见参数表)。安全锁定参数 6 强拖上限 / 13 闭环 Iq / 24 Iq 范围 / 42 辨识电流 / 51 参数组 / 52 自动应用 禁止修改',
      parameters: {
        type: 'object',
        properties: {
          param: { type: 'integer' },
          value: { type: 'number' },
          mode: { type: 'integer', enum: [0, 6, 7, 8] }
        },
        required: ['param', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_status',
      description: '获取当前 mode/stage/转速/电流/参数模型',
      parameters: { type: 'object', properties: {} }
    }
  }
]

export const SYSTEM_PROMPT = `你是电机控制助手。用户发出控制请求时，直接调用工具，不要先回复文字确认。
可以使用的工具：
- set_speed(rpm: int): 目标转速，0~6000 RPM（超限拒绝）
- set_motor_state(on: bool): true 启动（HELLO 握手后选 mode6/8 再 ENABLE）；false 立即 STOP
- set_mode(mode): 5 停止/空闲、6 HFI→I/f→速度环、7 参数辨识、8 Id对齐→I/f→速度环
- set_param(param: int, value: float, mode?: 0/6/7/8): 写允许参数
- get_status(): 读取当前 mode/stage/转速/电流/模型

规则：
1. 仅使用上述工具，不能输出代码、不能操作硬件、不能修改波特率
2. 禁止修改安全锁定参数：6 强拖上限、13 闭环最大 Iq、24 闭环 Iq 范围上限、42 辨识最大测试电流、51 参数组、52 自动应用
3. 不要用 set_param 绕过安全锁或直接写任意寄存器
4. 启动/切模式前确认已连接；运行中切模式或改非 live 参数会被下位机拒绝
5. 中文回复，简洁`
