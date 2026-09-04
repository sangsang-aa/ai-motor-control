/**
 * 测试点 4 + 5:串口能正常识别;示波器接收串口数据并输出正常波形。
 * fake navigator.serial 模拟 Modbus RTU 从站(内置 ACTUAL_SPEED=2000/ACTUAL_CURRENT=3.0),
 * 上位机每 50ms 轮询 0x03 读遥测 → telemetry → scopeStore → SVG。
 */
import { test, expect, Page } from '@playwright/test'
import { fakeSerialInitScript } from './mockSerial'

test('串口识别:点击连接后显示已连接 + 设备名 + 转速/电流非零', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript())
  await page.goto('/')
  await page.waitForSelector('header.topbar')
  await page.locator('header.topbar button', { hasText: '连接串口' }).click()
  await expect(page.locator('header.topbar')).toContainText('已连接')
  await expect(page.locator('header.topbar')).toContainText('USB:2345:6789')
  await expect(async () => {
    const rpmText = await page.locator('.topbar-stat').first().textContent()
    const m = (rpmText || '').match(/\d+/)
    expect(m && parseInt(m[0]) > 0).toBe(true)
  }).toPass({ timeout: 5000 })
})

test('示波器:接收串口数据并渲染正常波形(SVG path)', async ({ page }) => {
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
