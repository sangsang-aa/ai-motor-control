/**
 * 测试点 3:tool 正常 calling。
 * mock LLM 返回纯 tool_call(无 text) → 断言 ConfirmCard 出现、确认/忽略流程完整。
 * 用例 2 注入 fake serial 验证确认后实际写入串口命令字节。
 */
import { test, expect, Page } from '@playwright/test'
import { fakeSerialInitScript, buildWaveformBytes, getSerialWrites } from './mockSerial'

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
  await page.locator('button', { hasText: '发送' }).click()
  // ConfirmCard 出现,显示工具意图
  const card = page.locator('.cfm-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('设置转速: 3000 RPM')
  // 点击忽略 → 卡片消失,lock 解除(不再显示锁定横幅)
  await card.locator('button', { hasText: '忽略' }).click()
  await expect(page.locator('.cfm-card')).toHaveCount(0)
})

test('tool_call 确认后实际写入串口命令(需 fake serial)', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript(buildWaveformBytes()))
  await mockLlm(page, SSE_TOOL)
  await page.goto('/')
  await page.waitForSelector('textarea')
  // 先连接串口
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  // 发送工具消息
  await page.locator('textarea').fill('把转速设到三千')
  await page.locator('button', { hasText: '发送' }).click()
  const card = page.locator('.cfm-card')
  await expect(card).toBeVisible()
  await card.locator('button', { hasText: '确认执行' }).click()
  // 串口收到 set_speed(3000, on=1) 的编码字节: [0xb8,0x0b,0x01,0x00]
  await page.waitForTimeout(300)
  const writes = await getSerialWrites(page)
  expect(writes.length).toBeGreaterThanOrEqual(1)
  const last = writes[writes.length - 1]
  expect(last).toEqual([0xb8, 0x0b, 0x01, 0x00])
  // 执行结果气泡 + lock 解除
  await expect(page.locator('.msg-bbl.asst')).toContainText('OK rpm=3000 on=1')
})
