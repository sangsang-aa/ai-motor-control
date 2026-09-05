/**
 * 测试点 1:网页界面正常启动、渲染;界面按钮能正常按动、拖拽调整大小。
 * 注:Web 版"窗口"即浏览器窗口,窗口自身行为(最小化/放大)由操作系统负责;
 * 这里测应用内可交互元素:Topbar 按钮、侧栏折叠、侧栏拖拽调整宽度、页面渲染。
 */
import { test, expect, Page } from '@playwright/test'

async function gotoChat(page: Page) {
  await page.goto('/')
  await page.waitForSelector('.topbar')
}

test('页面正常启动并渲染核心元素', async ({ page }) => {
  await gotoChat(page)
  await expect(page.locator('.topbar')).toBeVisible()
  // 品牌商标(侧栏顶部 FluxPilot 图)
  await expect(page.locator('aside.sidebar img[src="/trademark.png"]')).toBeVisible()
  // Topbar 连接按钮(未连接时)
  await expect(page.locator('header.topbar button', { hasText: '连接串口' })).toBeVisible()
  // 欢迎文案
  await expect(page.locator('.welcome')).toContainText('您好，今天要干什么？')
  // 会话 sidebar
  await expect(page.locator('aside.sidebar')).toBeVisible()
  // Composer 输入框
  await expect(page.locator('textarea')).toBeVisible()
})

test('Topbar 波特率输入可交互 + 按钮可点击', async ({ page }) => {
  await gotoChat(page)
  const baud = page.locator('header.topbar input')
  await baud.fill('1500000')
  await expect(baud).toHaveValue('1500000')
  const btn = page.locator('header.topbar button', { hasText: '连接串口' })
  await expect(btn).toBeEnabled()
})

test('侧栏可折叠与展开', async ({ page }) => {
  await gotoChat(page)
  await page.locator('button[title="收起侧栏"]').dispatchEvent('click')
  await expect(page.locator('button[title="展开侧栏"]')).toBeVisible()
  await page.locator('button[title="展开侧栏"]').dispatchEvent('click')
  await expect(page.locator('button[title="收起侧栏"]')).toBeVisible()
})

test('侧栏为固定窄宽(Altior 风格,无拖拽)', async ({ page }) => {
  await gotoChat(page)
  const aside = page.locator('aside.sidebar')
  const w = await aside.evaluate((el) => (el as HTMLElement).offsetWidth)
  expect(w).toBeGreaterThanOrEqual(230)
  expect(w).toBeLessThanOrEqual(250)
})

test('新建会话按钮可创建会话', async ({ page }) => {
  await gotoChat(page)
  await page.locator('button', { hasText: '新建对话' }).click()
  // 会话列表出现一个"新会话"
  await expect(page.locator('aside .sb-item').first()).toBeVisible()
})

test('示波器页正常渲染', async ({ page }) => {
  // 直接进 /scope
  await page.goto('/scope')
  await page.waitForSelector('header')
  await expect(page.locator('header').first()).toContainText('示波器')
  await expect(page.locator('header')).toContainText('未连接')
  // 返回聊天链接
  await expect(page.locator('a', { hasText: '返回聊天' })).toBeVisible()
})
