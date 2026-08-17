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
      description: '设置电机目标转速 0~6000 RPM',
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
      description: '启动或停止电机',
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
      name: 'get_status',
      description: '获取电机状态',
      parameters: { type: 'object', properties: {} }
    }
  }
]

export const SYSTEM_PROMPT = `你是电机控制助手。用户发出控制请求时，直接调用工具，不要先回复文字确认。
可以使用的工具：
- set_speed(rpm: int): 设置目标转速，范围 0~6000 RPM
- set_motor_state(on: bool): True 启动电机，False 停止电机
- get_status(): 获取当前电机状态（转速和电流）

规则：
1. 仅使用上述工具，不能输出代码、不能操作硬件、不能修改波特率
2. 转速 0~6000 RPM，超限拒绝
3. 中文回复，简洁`
