import { test, expect } from '@playwright/test'
import { fakeAiMotorSerial, getAiWrites, decodeAiCommands } from './mockAiMotorSerial'

test('侧栏进入手动控制 + 连接', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('aside.sidebar a[href="/control"]').first().click()
  await expect(page).toHaveURL(/\/control$/)
  await page.getByTestId('ctl-connect').click()
  await expect(page.getByText('已连接').first()).toBeVisible()
})

test('选模式 → 启动 → 调速 → 调参 → 回读', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await page.goto('/control')
  await page.getByTestId('ctl-connect').click()
  await expect(page.getByText('已连接').first()).toBeVisible()

  await page.getByTestId('mode-6').click()
  await page.getByTestId('ctl-enable').click()
  await page.waitForTimeout(300)

  await page.getByTestId('target-rpm').fill('1200')
  await page.getByTestId('apply-speed').click()
  await page.getByTestId('speed-reverse').click()
  await page.waitForTimeout(300)

  await expect(async () => {
    const count = await page.locator('[data-testid="wave-speed"] path').count()
    expect(count).toBeGreaterThan(0)
  }).toPass({ timeout: 5000 })
  await page.getByTestId('wave-tab-phase').click()
  await expect(async () => {
    const count = await page.locator('[data-testid="wave-phase"] path').count()
    expect(count).toBeGreaterThanOrEqual(3)
  }).toPass({ timeout: 5000 })

  await page.getByTestId('group-tab-1').click()
  await page.getByTestId('param-11').fill('0.005')
  await page.getByTestId('apply-group').click()
  await page.waitForTimeout(300)

  await page.getByTestId('reload-config').click()
  await expect(page.getByTestId('config-count')).toContainText('已回读 4 条')

  const cmds = decodeAiCommands(await getAiWrites(page))
  expect(cmds.some((c) => c.cmd === 2 && c.mode === 6)).toBe(true)
  expect(cmds.some((c) => c.cmd === 4 && c.mode === 6)).toBe(true)
  expect(cmds.some((c) => c.cmd === 3 && c.mode === 6 && c.param === 1 && c.value === 1200)).toBe(true)
  expect(cmds.some((c) => c.cmd === 3 && c.mode === 6 && c.param === 1 && c.value === -1200)).toBe(true)
  const kp = cmds.find((c) => c.cmd === 3 && c.mode === 6 && c.param === 11)
  expect(kp).toBeTruthy()
  expect(kp!.value).toBeCloseTo(0.005, 6)
})

test('波形:暂停/清空/导出 CSV', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await page.goto('/control')
  await page.getByTestId('ctl-connect').click()
  await expect(page.getByText('已连接').first()).toBeVisible()
  await expect(async () => {
    const count = await page.locator('[data-testid="wave-speed"] path').count()
    expect(count).toBeGreaterThan(0)
  }).toPass({ timeout: 5000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-wave-csv').click()
  ])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)

  await page.getByTestId('wave-pause').click()
  await expect(page.getByTestId('wave-pause')).toHaveText('继续绘图')
  await page.getByTestId('wave-clear').click()
  await expect(page.locator('[data-testid="wave-speed"] path')).toHaveCount(0)
})

test('安全限制参数手动修改需二次确认', async ({ page }) => {
  await page.addInitScript(fakeAiMotorSerial())
  await page.goto('/control')
  await page.getByTestId('ctl-connect').click()
  await expect(page.getByText('已连接').first()).toBeVisible()

  page.once('dialog', async (dialog) => { await dialog.accept() })
  await page.getByTestId('group-tab-1').click()
  await page.getByTestId('param-24').fill('5')
  await page.getByTestId('apply-group').click()
  await page.waitForTimeout(300)

  const cmds = decodeAiCommands(await getAiWrites(page))
  expect(cmds.some((c) => c.cmd === 3 && c.mode === 6 && c.param === 24 && c.value === 5)).toBe(true)
})

test('演示模式 + CSV 记录下载', async ({ page }) => {
  await page.goto('/control')
  await page.getByTestId('ctl-demo').click()
  await expect(page.getByTestId('speed-live')).not.toHaveText('—')

  await page.getByTestId('rec-start').click()
  await expect.poll(async () => {
    const text = await page.getByTestId('rec-count').textContent()
    return Number(text?.match(/\d+/)?.[0] ?? 0)
  }).toBeGreaterThan(0)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('rec-stop').click()
  ])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
})
