/**
 * 测试点 4 + 5:串口能正常识别;示波器接收串口数据并输出正常波形。
 * fake navigator.serial 模拟 Modbus RTU 从站(内置 ACTUAL_SPEED=2000/ACTUAL_CURRENT=3.0),
 * 上位机每 50ms 轮询 0x03 读遥测 → telemetry → scopeStore → SVG。
 */
import { test, expect, Page } from '@playwright/test'
import { fakeSerialInitScript } from './mockSerial'

test('串口识别:点击连接后显示已连接 + 设备名', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript())
  await page.goto('/')
  await page.waitForSelector('header.topbar')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await expect(page.locator('header.topbar')).toContainText('USB:2345:6789')
  const directPortSetup = await page.evaluate(() => ({
    signals: (window as any).__sfSignals,
    openOptions: (window as any).__sfOpenOptions,
    readPendingAtWrite: (window as any).__sfReadPendingAtWrite
  }))
  expect(directPortSetup.openOptions).toEqual([{
    baudRate: 781250,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    bufferSize: 4096,
    flowControl: 'none'
  }])
  expect(directPortSetup.signals).toEqual([
    { dataTerminalReady: false }
  ])
  expect(directPortSetup.readPendingAtWrite.length).toBeGreaterThan(0)
  expect(directPortSetup.readPendingAtWrite.every(Boolean)).toBe(true)
})

test('示波器:接收串口遥测并渲染曲线(SVG path)', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript())
  await page.goto('/')
  await page.waitForSelector('header.topbar')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await page.waitForTimeout(500)
  await page.locator('aside.sidebar a[href="/scope"]').click()
  await page.waitForSelector('header')
  await expect(page.locator('header').first()).toContainText('已连接')
  await expect(async () => {
    const pathCount = await page.locator('svg path').count()
    expect(pathCount).toBeGreaterThan(0)
  }).toPass({ timeout: 5000 })
  await expect(page.locator('svg text', { hasText: 'Speed (RPM)' }).first()).toBeVisible()
  // 实时数据区:标题 + 通道名(跟随 ChannelPanel 命名)+ 非零值
  await expect(page.locator('text=实时数据').first()).toBeVisible()
  await expect(page.locator('text=Speed (RPM)').first()).toBeVisible()
  await expect(async () => {
    const val = await page.locator('text=实时数据').locator('..').locator('b').first().textContent()
    expect(val && parseFloat(val) > 0).toBe(true)
  }).toPass({ timeout: 5000 })
  // 遥测轮询持续灌入后，SVG path 应形成多点曲线。
  await expect(async () => {
    const d = await page.locator('svg path').first().getAttribute('d')
    const segments = (d || '').split('L').length - 1
    expect(segments).toBeGreaterThan(1)
  }).toPass({ timeout: 5000 })
})

test('示波器:暂停按钮可切换(暂停逻辑)', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript())
  await page.goto('/scope')
  await page.waitForSelector('header')
  const pause = page.locator('button', { hasText: '暂停' })
  await expect(pause).toBeVisible()
  await pause.click()
  await expect(page.locator('button', { hasText: '继续' })).toBeVisible()
})
