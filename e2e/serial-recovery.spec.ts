/** 串口从站未响应时，控制器必须释放 reader 并允许用户重新连接。 */
import { test, expect } from '@playwright/test'
import { fakeSerialInitScript } from './mockSerial'

test('首个 Modbus 响应超时不误报连接，用户可重新连接', async ({ page }) => {
  await page.addInitScript(fakeSerialInitScript({ dropFirstResponse: true }))
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
  await expect(topbar).toContainText('未连接')

  await connectButton.click()
  await expect(topbar).toContainText('已连接')
})
