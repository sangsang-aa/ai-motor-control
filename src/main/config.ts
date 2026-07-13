import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { parse as parseYaml } from 'yaml'

export interface AppConfig {
  llm: {
    baseUrl: string
    apiKey: string
    modelName: string
    systemPrompt: string
  }
  motor: {
    port: string
    baudRate: number
    rpmLimit: number
    currentAlarmThreshold: number
  }
}

const CONFIG_DIR = join(app.getPath('userData'), 'config')

export function readConfig(): AppConfig {
  const llmPath = join(CONFIG_DIR, 'llm_config.yaml')
  const motorPath = join(CONFIG_DIR, 'motor_config.yaml')

  // Try runtime config first, fall back to project-level defaults
  const llmYaml = existsSync(llmPath)
    ? readYaml(llmPath)
    : readYaml(join(__dirname, '../../config/llm_config.yaml'))

  const motorYaml = existsSync(motorPath)
    ? readYaml(motorPath)
    : readYaml(join(__dirname, '../../config/motor_config.yaml'))

  return {
    llm: {
      baseUrl: llmYaml.base_url || 'https://ws-4re9lk3au8wwdleg.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
      apiKey: llmYaml.api_key || '',
      modelName: llmYaml.model_name || 'qwen-plus',
      systemPrompt: llmYaml.system_prompt || ''
    },
    motor: {
      port: motorYaml.port || '/dev/ttyUSB0',
      baudRate: motorYaml.baud_rate || 150000,
      rpmLimit: motorYaml.rpm_limit || 6000,
      currentAlarmThreshold: motorYaml.current_alarm_threshold || 10.0
    }
  }
}

function readYaml(filePath: string): Record<string, unknown> {
  const content = readFileSync(filePath, 'utf-8')
  return (parseYaml(content) as Record<string, unknown>) || {}
}
