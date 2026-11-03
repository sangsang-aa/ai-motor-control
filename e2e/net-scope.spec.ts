import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const WAVE_POINTS = 200

function makeChannel(name: string, phase = 0) {
  const y = Array.from({ length: WAVE_POINTS }, (_, i) =>
    Math.sin((i / WAVE_POINTS) * Math.PI * 4 + phase)
  )
  return {
    name,
    yUnits: 'V',
    xUnits: 's',
    dt: 1e-6,
    triggerIndex: 100,
    ySpacing: 0.1,
    yOffset: 0,
    points: WAVE_POINTS,
    samples: WAVE_POINTS,
    stride: 1,
    y
  }
}

async function installMock(page: import('@playwright/test').Page) {
  const counter = { acquire: 0 }
  await page.route('**/api/tekhsi', async (route) => {
    const req = route.request()
    if (req.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) })
      return
    }
    const body = req.postDataJSON() as any
    if (body.action === 'connect') {
      if (body.host === '10.0.0.1') {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: '连接失败：设备无响应' })
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          host: body.host,
          port: body.port,
          protocolVersion: 200,
          capabilities: 3,
          channels: ['ch1', 'ch2']
        })
      })
      return
    }
    if (body.action === 'acquire') {
      counter.acquire += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          capturedAt: Date.now(),
          channels: [makeChannel('ch1'), makeChannel('ch2', Math.PI / 2)],
          errors: []
        })
      })
      return
    }
    if (body.action === 'disconnect') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad action' }) })
  })
  return counter
}

test('侧栏进入网口示波器', async ({ page }) => {
  await installMock(page)
  await page.goto('/')
  const link = page.locator('aside.sidebar a[href="/net-scope"]')
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(/\/net-scope$/)
  await expect(page.getByText('网口示波器').first()).toBeVisible()
})

test('连接 → 通道 → 采集 → 波形 → 导出 CSV', async ({ page }) => {
  await installMock(page)
  await page.goto('/net-scope')

  await page.getByTestId('net-host').fill('192.168.0.10')
  await page.getByTestId('net-connect').click()
  await expect(page.getByTestId('net-status')).toContainText('已连接')
  await expect(page.getByTestId('net-channel-ch1')).toBeChecked()
  await expect(page.getByTestId('net-channel-ch2')).toBeChecked()

  await page.getByTestId('net-acquire').click()
  await expect(page.getByTestId('net-chart-ch1').locator('path')).toHaveCount(1)
  await expect(page.getByTestId('net-chart-ch2').locator('path')).toHaveCount(1)
  await expect(page.getByTestId('net-meta')).toContainText('ch1')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('net-export').click()
  ])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  const file = await download.path()
  const csv = fs.readFileSync(file!, 'utf8')
  expect(csv).toContain('channel,time_s,value')
  expect(csv).toContain('ch1,')
  expect(csv).toContain('ch2,')
})

test('连续采集 1Hz 可开关', async ({ page }) => {
  const counter = await installMock(page)
  await page.goto('/net-scope')
  await page.getByTestId('net-host').fill('192.168.0.10')
  await page.getByTestId('net-connect').click()
  await expect(page.getByTestId('net-status')).toContainText('已连接')

  await page.getByTestId('net-continuous').check()
  await expect.poll(() => counter.acquire, { timeout: 5000 }).toBeGreaterThanOrEqual(2)

  await page.getByTestId('net-continuous').uncheck()
  await page.waitForTimeout(1500)
  const stopped = counter.acquire
  await page.waitForTimeout(1500)
  expect(counter.acquire).toBe(stopped)
})

test('连接失败显示错误且保持未连接', async ({ page }) => {
  await installMock(page)
  await page.goto('/net-scope')
  await page.getByTestId('net-host').fill('10.0.0.1')
  await page.getByTestId('net-connect').click()
  await expect(page.getByTestId('net-error')).toContainText('连接失败')
  await expect(page.getByTestId('net-status')).toContainText('未连接')
  await expect(page.getByTestId('net-empty')).toBeVisible()
})
