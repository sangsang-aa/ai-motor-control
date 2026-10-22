/**
 * 测试点 3:tool 正常 calling。
 * mock LLM 返回纯 tool_call → 断言 ConfirmCard 出现、确认/忽略流程完整。
 * 用例 2 注入 AI-Motor 从站,验证确认后下发的 SET_PARAM 帧。
 */
import { test, expect, Page } from '@playwright/test'
import { fakeAiMotorSerial, getAiWrites, decodeAiCommands } from './mockAiMotorSerial'

const SSE_TOOL = [
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"set_speed","arguments":""}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"rpm\\":3000}"}}]}}]}\n\n',
  'data: [DONE]\n\n',
].join('')

const SSE_START = [
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"set_motor_state","arguments":""}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"on\\":true}"}}]}}]}\n\n',
  'data: [DONE]\n\n',
].join('')

const SSE_LOCKED = [
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"set_param","arguments":""}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"param\\":24,\\"value\\":10}"}}]}}]}\n\n',
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

test('set_motor_state 启动 → SET_MODE + ENABLE', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await mockLlm(page, SSE_START)
  await page.goto('/')
  await page.waitForSelector('textarea')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await page.locator('textarea').fill('启动电机')
  await page.locator('.composer-send').click()
  const card = page.locator('.cfm-card')
  await expect(card).toContainText('启动电机')
  await card.locator('button', { hasText: '确认执行' }).click()
  await expect(page.locator('.msg-bbl.asst')).toContainText('OK motor_on=1 mode=6')

  const cmds = decodeAiCommands(await getAiWrites(page))
  expect(cmds.some((c) => c.cmd === 2 && c.mode === 6)).toBe(true)
  expect(cmds.some((c) => c.cmd === 4 && c.mode === 6)).toBe(true)
})

test('安全锁定参数被拒绝(不下发 SET_PARAM)', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await mockLlm(page, SSE_LOCKED)
  await page.goto('/')
  await page.waitForSelector('textarea')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await page.locator('textarea').fill('把 Iq 范围调到 10A')
  await page.locator('.composer-send').click()
  const card = page.locator('.cfm-card')
  await expect(card).toContainText('闭环 Iq 范围上限')
  await card.locator('button', { hasText: '确认执行' }).click()
  await expect(page.locator('.msg-bbl.asst')).toContainText('安全锁定')

  const cmds = decodeAiCommands(await getAiWrites(page))
  expect(cmds.some((c) => c.cmd === 3 && c.param === 24)).toBe(false)
})
