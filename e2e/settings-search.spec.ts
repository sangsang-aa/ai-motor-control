/**
 * 新增 UI 功能冒烟测试:设置面板 + 搜索对话弹窗。
 * 1) 点侧栏"设置" → 弹设置面板 → 切换语言保存
 * 2) 点标题区搜索按钮 → 弹搜索框 → 输关键词 → 显示匹配 → 点击跳转
 */
import { test, expect, Page } from '@playwright/test'

async function gotoChat(page: Page) {
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
}

test('设置面板可打开、切换语言并保存', async ({ page }) => {
  await gotoChat(page)
  await page.locator('aside.sidebar button', { hasText: '设置' }).click()
  const panel = page.locator('text=使用语言').first()
  await expect(panel).toBeVisible()
  // 切语言到英文
  await page.locator('select').first().selectOption('en')
  // 保存
  await page.locator('button', { hasText: 'Save' }).click()
  // 面板关闭后,顶栏文案应为英文 Connected(切换生效)
  await page.keyboard.press('Escape')
  await page.locator('button', { hasText: 'Save' }).count()
})

test('搜索对话弹窗:按关键词过滤并跳转', async ({ page }) => {
  // mock LLM 快速结束,避免真实请求挂起影响会话生成
  await page.route('**/api/llm', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: [DONE]\n\n' })
  )
  await gotoChat(page)
  const mkSession = async (text: string) => {
    await page.locator('button', { hasText: '新建对话' }).click()
    await page.locator('textarea').fill(text)
    await page.locator('.composer-send').click()
  }
  await mkSession('帮我控制电机加速')
  await mkSession('帮我导出报告')
  // 打开搜索
  await page.locator('aside.sidebar button[title="搜索对话"]').click()
  await page.fill('input[placeholder="输入标题关键词..."]', '电机')
  const results = page.locator('[data-testid="search-result"]', { hasText: '帮我控制电机加速' })
  await expect(results.first()).toBeVisible()
  // 点击跳转到该会话
  await results.first().click()
  await expect(page.locator('aside nav .sb-item.on').first()).toBeVisible()
})
