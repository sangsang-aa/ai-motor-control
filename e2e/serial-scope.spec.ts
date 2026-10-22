import { test, expect } from '@playwright/test'
import { fakeAiMotorSerial, getAiOpenOptions, getAiSignals } from './mockAiMotorSerial'

test('串口识别:AI-Motor 连接 + 设备名 + 115200 8N1', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await page.goto('/')
  await page.waitForSelector('header.topbar')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await expect(page.locator('header.topbar')).toContainText('USB:0451:BEF3')

  const openOptions = await getAiOpenOptions(page)
  expect(openOptions).toEqual([{
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    bufferSize: 4096,
    flowControl: 'none'
  }])
  expect(await getAiSignals(page)).toEqual([{ dataTerminalReady: false }])
})

test('示波器:接收 100Hz 遥测并渲染曲线(SVG path)', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial({ sample: { reference: 2000, speed: 2000, iu: 3, iq: 2 } }))
  await page.goto('/')
  await page.waitForSelector('header.topbar')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')

  await page.locator('aside.sidebar a[href="/scope"]').click()
  await page.waitForSelector('header')
  await expect(page.locator('header').first()).toContainText('已连接')

  await expect(async () => {
    const pathCount = await page.locator('svg path').count()
    expect(pathCount).toBeGreaterThan(0)
  }).toPass({ timeout: 5000 })
  await expect(page.locator('svg text', { hasText: 'Speed (RPM)' }).first()).toBeVisible()
  await expect(page.getByTestId('realtime-speed')).toContainText('2000')
  await expect(page.getByTestId('realtime-current')).toContainText('3.000')

  const currentPath = page.locator('svg path').first()
  await expect(currentPath).toHaveAttribute('d', /L/)
  const firstPath = await currentPath.getAttribute('d')
  await expect.poll(() => currentPath.getAttribute('d')).not.toBe(firstPath)
})

test('示波器:暂停按钮可切换(暂停逻辑)', async ({ page }) => {
  await page.goto('/scope')
  await page.waitForSelector('header')
  const pause = page.locator('button', { hasText: '暂停' })
  await expect(pause).toBeVisible()
  await pause.click()
  await expect(page.locator('button', { hasText: '继续' })).toBeVisible()
})
