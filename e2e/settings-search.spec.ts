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

test('设置面板:供应商列表屏切换语言并持久化', async ({ page }) => {
  await gotoChat(page)
  await page.locator('aside.sidebar button', { hasText: '设置' }).click()
  await expect(page.locator('text=使用语言').first()).toBeVisible()
  // 第一屏为供应商列表,API Key 输入不在同屏
  await expect(page.locator('[data-testid="settings-provider-item"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="settings-api-key"]')).toHaveCount(0)
  // 切语言到英文(立即持久化)
  await page.locator('select').first().selectOption('en')
  const raw = await page.evaluate(() => localStorage.getItem('mototune.settings'))
  expect(raw).toContain('"language":"en"')
  await page.locator('[data-testid="settings-close"]').click()
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

test('设置改模型后 Topbar 即时更新(响应式)', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('aside.sidebar button', { hasText: '设置' }).click()
  // 步骤1:选「自定义」供应商 → 进入 API 屏
  await page.locator('[data-testid="settings-provider-item"]', { hasText: '自定义' }).click()
  await page.locator('[data-testid="settings-model"]').fill('deepseek-chat')
  await page.locator('[data-testid="settings-save"]').click()
  await page.locator('[data-testid="settings-close"]').click()
  // Topbar 模型 pill 应显示 deepseek-chat(而非 qwen)
  await expect(page.locator('.model-pill')).toContainText('deepseek-chat')
})

test('Topbar 模型下拉:选择后即时更新并持久化', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  // 选一个带模型列表的供应商(OpenAI)并保存
  await page.locator('aside.sidebar button', { hasText: '设置' }).click()
  await page.locator('[data-testid="settings-provider-item"]', { hasText: 'OpenAI' }).click()
  await expect(page.locator('[data-testid="settings-model"]')).toBeVisible()
  await page.locator('[data-testid="settings-save"]').click()
  await page.locator('[data-testid="settings-close"]').click()
  // Topbar 模型 pill 下拉切换
  const pill = page.locator('.model-pill')
  await pill.click()
  await expect(page.locator('[data-testid="model-menu"]')).toBeVisible()
  await page.locator('[data-testid="model-menu-item"]', { hasText: 'o4-mini' }).click()
  await expect(pill).toContainText('o4-mini')
  const raw = await page.evaluate(() => localStorage.getItem('mototune.settings'))
  expect(raw).toContain('o4-mini')
})

test('对话设置:输入提示词并随请求发送,随会话保存', async ({ page }) => {
  let sentSystemPrompt: string | undefined
  await page.route('**/api/llm', (route) => {
    try { sentSystemPrompt = JSON.parse(route.request().postData() || '{}').systemPrompt } catch { /* ignore */ }
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: [DONE]\n\n' })
  })
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('button', { hasText: '新建对话' }).click()
  // 打开 "+" 菜单 → 对话设置
  await page.locator('[data-testid="composer-plus-menu"]').count()
  await page.locator('button[title="附加"]').click()
  await page.locator('[data-testid="menu-conv-settings"]').click()
  await page.locator('[data-testid="conv-system-prompt"]').fill('你是电机调参助手，只输出简洁结论')
  await page.locator('[data-testid="conv-save"]').click()
  // 发送消息 → 请求体应带该 systemPrompt
  await page.locator('textarea').fill('你好')
  await page.locator('.composer-send').click()
  await expect.poll(() => sentSystemPrompt).toBe('你是电机调参助手，只输出简洁结论')
  // 持久化:刷新后仍保留
  const raw = await page.evaluate(() => localStorage.getItem('mototune.sessions'))
  expect(raw).toContain('你是电机调参助手')
})
