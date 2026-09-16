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
