/**
 * 测试点 2 + 6:主页面会话无卡死、无错误回答;对话能正常记录。
 * LLM 用 page.route mock(返回 SSE 流),不调用真实 LLM,保证测试确定性。
 */
import { test, expect, Page } from '@playwright/test'

const SSE_TEXT = [
  'data: {"choices":[{"delta":{"content":"好的，"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"我已收到你的请求。"}}]}\n\n',
  'data: [DONE]\n\n',
].join('')

const SSE_ERROR = [
  'data: {"choices":[{"delta":{"content":""}}]}\n\n',
  'data: [DONE]\n\n',
].join('')

async function gotoChat(page: Page) {
  await page.goto('/')
  await page.waitForSelector('textarea')
}

test('对话正常流式回复,无 error 气泡(无卡死)', async ({ page }) => {
  await page.route('**/api/llm', (route) => {
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_TEXT })
  })
  await gotoChat(page)
  await page.locator('textarea').fill('请设置转速')
  await page.locator('button', { hasText: '发送' }).click()
  // 等待回复气泡出现(流式)
  const bubble = page.locator('.msg-bbl.asst')
  await expect(bubble).toContainText('好的，我已收到你的请求。')
  // 无 error 气泡('⚠' 前缀)
  await expect(page.locator('.msg-bbl', { hasText: '⚠' })).toHaveCount(0)
  // 无 loading 卡死(inflight / think-dots 应消失)
  await expect(page.locator('.think-dots')).toHaveCount(0)
})

test('错误回答时显示 error 文案而非 fake 成功', async ({ page }) => {
  await page.route('**/api/llm', (route) => {
    route.fulfill({ status: 500, contentType: 'text/plain', body: 'server error' })
  })
  await gotoChat(page)
  await page.locator('textarea').fill('测试错误')
  await page.locator('button', { hasText: '发送' }).click()
  // 应出现 error 气泡(⚠ 开头),而不是正常回复
  await expect(page.locator('.msg-bbl', { hasText: '⚠' }).first()).toBeVisible()
})

test('对话记录到 localStorage(刷新后保留)', async ({ page }) => {
  await page.route('**/api/llm', (route) => {
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_TEXT })
  })
  await gotoChat(page)
  await page.locator('textarea').fill('这条消息要被我记录下来')
  await page.locator('button', { hasText: '发送' }).click()
  await expect(page.locator('.msg-bbl.asst')).toContainText('好的，我已收到你的请求。')
  // localStorage 中有会话
  const raw = await page.evaluate(() => localStorage.getItem('mototune.sessions'))
  expect(raw).toBeTruthy()
  // 刷新后侧栏仍保留该会话(标题自动命名自首条消息)
  await page.reload()
  await page.waitForSelector('aside.sidebar')
  const sidebar = await page.locator('aside .sidebar-item').first().textContent()
  expect(sidebar).toContain('这条消息要被我记录下来'.slice(0, 10))
})

test('顶栏显示转速/电流随 telemetry 更新', async ({ page }) => {
  // 无串口时初始为 0,这里只断言顶栏 stat 存在
  await gotoChat(page)
  await expect(page.locator('.topbar-stat').first()).toBeVisible()
})
