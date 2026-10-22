import { test, expect } from '@playwright/test'
import { fakeAiMotorSerial, getAiWrites, decodeAiCommands } from './mockAiMotorSerial'

test('HELLO 首包 ACK 丢失时同 seq 自动重试', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial({ dropFirstAck: true }))
  await page.goto('/')
  const topbar = page.locator('header.topbar')
  await topbar.getByRole('button', { name: '连接串口' }).click()
  await expect(topbar).toContainText('已连接')

  const hellos = decodeAiCommands(await getAiWrites(page)).filter((c) => c.cmd === 6)
  expect(hellos.length).toBeGreaterThanOrEqual(2)
})

test('HELLO 连续无响应时报错并可重新连接', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial({ noHelloAckCount: 3 }))
  await page.goto('/')
  const topbar = page.locator('header.topbar')
  const connectButton = topbar.getByRole('button', { name: '连接串口' })

  let errorMessage = ''
  page.once('dialog', async (dialog) => {
    errorMessage = dialog.message()
    await dialog.dismiss()
  })

  await connectButton.click()
  await expect.poll(() => errorMessage).toContain('握手失败')
  await expect(topbar).toContainText('未连接')

  await connectButton.click()
  await expect(topbar).toContainText('已连接')
})
