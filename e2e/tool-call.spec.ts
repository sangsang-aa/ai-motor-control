/**
 * 测试点 3:tool 正常 calling。
 * mock LLM 返回纯 tool_call → 断言 ConfirmCard 出现、确认/忽略流程完整。
 * 用例 2 注入 Modbus 从站,验证确认后写入的 Modbus 请求帧(写单寄存器 0x06)。
 */
import { test, expect, Page } from '@playwright/test'
import { fakeAiMotorSerial, getAiWrites, decodeAiCommands } from './mockAiMotorSerial'

const SSE_TOOL = [
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"set_speed","arguments":""}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"rpm\\":3000}"}}]}}]}\n\n',
  'data: [DONE]\n\n',
].join('')

async function mockLlm(page: Page, body: string, status = 200) {
  await page.route('**/api/llm', (route) =>
    route.fulfill({ status, contentType: 'text/event-stream', body })
  )
}

test('tool_call 触发 ConfirmCard,可忽略(lock 解除)', async ({ page }) => {
  await mockLlm(page, SSE_TOOL)
  await page.goto('/')
  await page.waitForSelector('textarea')
  await page.locator('textarea').fill('把转速设到三千')
  await page.locator('.composer-send').click()
  const card = page.locator('.cfm-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('设置转速: 3000 RPM')
  await card.locator('button', { hasText: '忽略' }).click()
  await expect(page.locator('.cfm-card')).toHaveCount(0)
})

test('tool_call 确认后下发 AI-Motor SET_PARAM(需 fake serial)', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await mockLlm(page, SSE_TOOL)
  await page.goto('/')
  await page.waitForSelector('textarea')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await page.locator('textarea').fill('把转速设到三千')
  await page.locator('.composer-send').click()
  const card = page.locator('.cfm-card')
  await expect(card).toBeVisible()
  await card.locator('button', { hasText: '确认执行' }).click()
  await page.waitForTimeout(400)
  const cmds = decodeAiCommands(await getAiWrites(page))
  const speedWrite = cmds.find((c) => c.cmd === 3 && c.mode === 6 && c.param === 1 && c.value === 3000)
  expect(speedWrite).toBeTruthy()
  await expect(page.locator('.msg-bbl.asst')).toContainText('OK rpm=3000')
})
