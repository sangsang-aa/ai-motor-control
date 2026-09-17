/** 串口从站未响应时，控制器必须释放 reader 并允许用户重新连接。 */
import { test, expect } from '@playwright/test'
import { fakeSerialInitScript, getSerialWrites } from './mockSerial'

test('首个 Modbus 响应丢失时在同一连接自动重试', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript({ dropFirstResponse: true }))
  await page.goto('/')
  const topbar = page.locator('header.topbar')
  const connectButton = topbar.getByRole('button', { name: '连接串口' })

  await connectButton.click()
  await expect(topbar).toContainText('已连接')
  await expect.poll(async () => (await getSerialWrites(page)).length).toBeGreaterThanOrEqual(2)
})

test('选中静默的 XDS110 辅助口时自动探测已授权控制口', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript({ includeSilentSibling: true }))
  await page.goto('/')
  const topbar = page.locator('header.topbar')

  await topbar.getByRole('button', { name: '连接串口' }).click()
  await expect(topbar).toContainText('已连接', { timeout: 5000 })
  const requestOptions = await page.evaluate(() => (window as any).__sfRequestOptions)
  expect(requestOptions).toEqual({
    filters: [{ usbVendorId: 0x0451, usbProductId: 0xbef3 }]
  })
  await expect.poll(async () => (await getSerialWrites(page)).length).toBeGreaterThanOrEqual(4)
})

test('连续三次无响应时释放 reader，用户可重新连接', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript({ dropResponseCount: 3 }))
  await page.goto('/')
  const topbar = page.locator('header.topbar')
  const connectButton = topbar.getByRole('button', { name: '连接串口' })
  let errorMessage = ''
  page.once('dialog', async (dialog) => {
    errorMessage = dialog.message()
    await dialog.dismiss()
  })

  await connectButton.click()
  await expect.poll(() => errorMessage).toContain('未收到 Modbus 从站')
  expect(errorMessage).toContain('尝试 3/3')
  expect(errorMessage).toContain('RX(0) <none>')
  await expect(topbar).toContainText('未连接')

  await connectButton.click()
  await expect(topbar).toContainText('已连接')
})

test('XDS110 DTR 设置失败时向用户报告而非静默超时', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript({ rejectDtrSignal: true }))
  await page.goto('/')
  const connectButton = page.locator('header.topbar').getByRole('button', { name: '连接串口' })
  let errorMessage = ''
  page.once('dialog', async (dialog) => {
    errorMessage = dialog.message()
    await dialog.dismiss()
  })

  await connectButton.click()
  await expect.poll(() => errorMessage).toContain('设置 XDS110 DTR=false 失败')
})
