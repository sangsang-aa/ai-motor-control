import { test, expect } from '@playwright/test'
import { fakeAiMotorSerial, getAiWrites, decodeAiCommands } from './mockAiMotorSerial'

test('侧栏可进入参数辨识', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('aside.sidebar a[href="/param-est"]').first().click()
  await expect(page).toHaveURL(/\/param-est$/)
  await expect(page.getByText('PMSM 参数辨识').first()).toBeVisible()
})

test('mode7:连接 → 下发配置 → 开始 → 显示已应用模型', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await page.goto('/param-est')
  await page.getByTestId('pe-connect').click()
  await expect(page.getByText('已连接').first()).toBeVisible()

  await page.getByTestId('pe-bus').fill('24')
  await page.getByTestId('pe-pole-pairs').fill('5')
  await page.getByTestId('pe-max-current').fill('5')
  await page.getByTestId('pe-start').click()

  await expect(page.getByTestId('res-Rs')).toHaveText('0.1943')
  await expect(page.getByTestId('res-Ld')).toHaveText('89.60')
  await expect(page.getByTestId('pe-stage')).toContainText('完成')

  const cmds = decodeAiCommands(await getAiWrites(page))
  expect(cmds.some((c) => c.cmd === 3 && c.param === 40 && c.mode === 7 && c.value === 24)).toBe(true)
  expect(cmds.some((c) => c.cmd === 3 && c.param === 41 && c.mode === 7 && c.value === 5)).toBe(true)
  expect(cmds.some((c) => c.cmd === 3 && c.param === 42 && c.mode === 7 && c.value === 5)).toBe(true)
  expect(cmds.some((c) => c.cmd === 2 && c.mode === 7)).toBe(true)
  expect(cmds.some((c) => c.cmd === 4 && c.mode === 7)).toBe(true)
})

test('mode7 失败显示具体原因', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial({ mode7Error: true }))
  await page.goto('/param-est')
  await page.getByTestId('pe-connect').click()
  await expect(page.getByText('已连接').first()).toBeVisible()
  await page.getByTestId('pe-start').click()
  await expect(page.getByTestId('pe-error')).toContainText('重复性不合格')
})
