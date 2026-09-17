/**
 * 测试点 4 + 5:串口能正常识别;示波器接收串口数据并输出正常波形。
 * fake navigator.serial 模拟 Modbus RTU 从站(内置 ACTUAL_SPEED=2000/ACTUAL_CURRENT=3.0),
 * 50ms 遥测更新数字，5kHz 波形批次持续进入 scopeStore 固定长度队列。
 */
import { test, expect, Page } from '@playwright/test'
import { fakeSerialInitScript, getSerialWrites } from './mockSerial'

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
  await expect.poll(async () => {
    const writes = await getSerialWrites(page)
    const countRead = (address: number, count: number) =>
      writes.filter(
        (request) =>
          request[1] === 0x03 &&
          ((request[2] << 8) | request[3]) === address &&
          ((request[4] << 8) | request[5]) === count
      ).length
    const batchAcks = writes.filter(
      (request) =>
        request[1] === 0x06 &&
        ((request[2] << 8) | request[3]) === 0x2201 &&
        request[4] === 0 &&
        request[5] === 0
    ).length
    return {
      telemetryContinues: countRead(0x1000, 4) >= 2,
      frameStateContinues: countRead(0x2200, 2) >= 2,
      allChunksContinue: [0x2000, 0x2032, 0x2064, 0x2096]
        .every((address) => countRead(address, 50) >= 2),
      batchAckContinues: batchAcks >= 2
    }
  }).toEqual({
    telemetryContinues: true,
    frameStateContinues: true,
    allChunksContinue: true,
    batchAckContinues: true
  })
  await expect(async () => {
    const pathCount = await page.locator('svg path').count()
    expect(pathCount).toBeGreaterThan(0)
  }).toPass({ timeout: 5000 })
  await expect(page.locator('svg text', { hasText: 'Speed (RPM)' }).first()).toBeVisible()
  await expect(page.getByTestId('realtime-speed')).toContainText('2000')
  await expect(page.locator('svg[aria-label="5kHz 电流动态波形"]')).toHaveCount(0)
  // 实时数据区:标题 + 通道名(跟随 ChannelPanel 命名)+ 非零值
  await expect(page.locator('text=实时数据').first()).toBeVisible()
  await expect(page.locator('text=Speed (RPM)').first()).toBeVisible()
  await expect(async () => {
    const val = await page.locator('text=实时数据').locator('..').locator('b').first().textContent()
    expect(val && parseFloat(val) > 0).toBe(true)
  }).toPass({ timeout: 5000 })
  // 新批次持续进入主示波器队列，下一批后 path 必须变化。
  const currentPath = page.locator('svg path').first()
  await expect(currentPath).toHaveAttribute('d', /L/)
  const firstPath = await currentPath.getAttribute('d')
  await expect.poll(() => currentPath.getAttribute('d')).not.toBe(firstPath)
  const segments = ((await currentPath.getAttribute('d')) || '').split('L').length - 1
  expect(segments).toBeGreaterThan(99)
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
