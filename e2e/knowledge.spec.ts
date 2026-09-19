/**
 * 知识库页面 E2E — 建库 / 上传图片 / 刷新持久化 / 删除文件。
 * 真实 Chromium 的 IndexedDB;不碰真实 LLM/串口。
 */
import { test, expect, Page } from '@playwright/test'

// 1x1 透明 PNG(内存生成,不依赖文件系统)
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function openKnowledge(page: Page) {
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('aside.sidebar a[href="/knowledge"]').click()
  await page.waitForSelector('[data-testid="kb-name-input"]')
}

test('知识库:创建 → 上传 → 刷新保留 → 删除文件', async ({ page }) => {
  await openKnowledge(page)

  // 1. 创建命名知识库
  await page.locator('[data-testid="kb-name-input"]').fill('电机手册')
  await page.locator('[data-testid="kb-create"]').click()
  await expect(page.locator('[data-testid="kb-item"]', { hasText: '电机手册' })).toBeVisible()

  // 2. 上传图片
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: PNG_1PX
  })
  await expect(page.locator('[data-testid="file-item"]', { hasText: 'sample.png' })).toBeVisible()

  // 3. 刷新后仍保留(IndexedDB 持久化)
  await page.reload()
  await page.waitForSelector('[data-testid="kb-item"]')
  await expect(page.locator('[data-testid="kb-item"]', { hasText: '电机手册' })).toBeVisible()
  await expect(page.locator('[data-testid="file-item"]', { hasText: 'sample.png' })).toBeVisible()

  // 4. 删除文件
  await page.locator('[data-testid="file-item"]', { hasText: 'sample.png' }).locator('[data-testid="file-delete"]').click()
  await expect(page.locator('[data-testid="file-item"]', { hasText: 'sample.png' })).toHaveCount(0)
})
