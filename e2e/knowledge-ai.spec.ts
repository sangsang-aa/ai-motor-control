/**
 * 知识库接入 AI E2E — 投送后每轮自动携带(记忆);清空后不再携带。
 * mock /api/llm 捕获请求体;真实 IndexedDB;不碰真实 LLM。
 */
import { test, expect, Page } from '@playwright/test'

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

type Req = { knowledge?: { images?: { dataUrl: string }[]; texts?: unknown[] } }

async function setup(page: Page) {
  await page.route('**/api/llm', (route) => {
    try {
      lastBody = JSON.parse(route.request().postData() || '{}') as Req
    } catch {
      lastBody = null
    }
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: [DONE]\n\n' })
  })
}

let lastBody: Req | null = null

test('知识库投送后每轮自动携带,清空后不再携带', async ({ page }) => {
  await setup(page)
  lastBody = null

  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('button', { hasText: '新建对话' }).click()

  // 建库 + 上传图片
  await page.locator('aside.sidebar a[href="/knowledge"]').click()
  await page.waitForSelector('[data-testid="kb-name-input"]')
  await page.locator('[data-testid="kb-name-input"]').fill('电机手册')
  await page.locator('[data-testid="kb-create"]').click()
  await page.locator('[data-testid="file-input"]').setInputFiles({ name: 'curve.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(page.locator('[data-testid="file-item"]', { hasText: 'curve.png' })).toBeVisible()

  // 回聊天 → 工具 → 知识库 → 勾选 → 投送
  await page.locator('a', { hasText: '返回聊天' }).click()
  await page.waitForSelector('textarea')
  await page.locator('button.composer-tool-pill', { hasText: '工具' }).click()
  await page.locator('[data-testid="tool-knowledge"]').click()
  await page.locator('[data-testid="kb-pick-item"] input').first().check()
  await page.locator('[data-testid="kb-deliver"]').click()

  // 第 1 次发送:请求应含图片多模态
  await page.locator('textarea').fill('请看知识库')
  await page.locator('.composer-send').click()
  await expect.poll(() => lastBody?.knowledge?.images?.length ?? 0).toBeGreaterThan(0)
  expect(lastBody!.knowledge!.images![0].dataUrl.startsWith('data:image')).toBe(true)

  // 第 2 次发送(未再次投送):仍自动携带 → 证明"记忆"
  lastBody = null
  await page.locator('textarea').fill('再问一个')
  await page.locator('.composer-send').click()
  await expect.poll(() => lastBody?.knowledge?.images?.length ?? 0).toBeGreaterThan(0)

  // 清空后再发送:不再携带
  await page.locator('button.composer-tool-pill', { hasText: '工具' }).click()
  await page.locator('[data-testid="tool-knowledge"]').click()
  await page.locator('[data-testid="kb-clear"]').click()
  lastBody = null
  await page.locator('textarea').fill('清空后提问')
  await page.locator('.composer-send').click()
  await expect.poll(() => lastBody !== null).toBe(true)
  expect(lastBody!.knowledge).toBeUndefined()
})
