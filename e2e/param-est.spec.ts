import { test, expect } from '@playwright/test'
import { fakeParamEstSerial, getPeWrites } from './mockParamEstSerial'

function decodeWrites(writes: number[][]) {
  return writes.map((w) => {
    const dv = new DataView(Uint8Array.from(w).buffer)
    return { cmd: dv.getFloat32(0, true), val: dv.getFloat32(4, true) }
  })
}

test('侧栏可进入参数辨识', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('aside.sidebar')
  await page.locator('aside.sidebar a[href="/param-est"]').first().click()
  await expect(page).toHaveURL(/\/param-est$/)
  await expect(page.getByText('PMSM 参数辨识').first()).toBeVisible()
})

test('连接 → 发命令 → 采集 → 空闲超时 → 辨识 → 显示结果', async ({ page }) => {
  await page.addInitScript(fakeParamEstSerial())
  await page.goto('/param-est')

  await page.getByRole('button', { name: '连接串口' }).click()
  await expect(page.getByText('已连接')).toBeVisible()

  await page.getByTestId('test-1').click()
  await page.getByTestId('btn-start').click()

  // 空闲超时后出结果:取 float1(=0.13),而非 float2(=9.99)
  await expect(page.getByTestId('res-Rs')).toHaveText(/0\.13/, { timeout: 8000 })

  // 下发过控制帧(命令 22)且位域正确:bit0=启停, bit4-7=测试号(Rs=1)
  const ctrl = decodeWrites(await getPeWrites(page)).find((w) => w.cmd === 22)
  expect(ctrl).toBeTruthy()
  expect(Math.trunc(ctrl!.val) & 0x01).toBe(1)
  expect((Math.trunc(ctrl!.val) >> 4) & 0x0f).toBe(1)
})

test('配置下发:命令 1..21 顺序正确', async ({ page }) => {
  await page.addInitScript(fakeParamEstSerial())
  await page.goto('/param-est')
  await page.getByRole('button', { name: '连接串口' }).click()
  await expect(page.getByText('已连接')).toBeVisible()

  await page.getByTestId('cfg-send').click()
  await expect.poll(async () => (await getPeWrites(page)).length, { timeout: 5000 }).toBeGreaterThanOrEqual(21)

  const cmds = decodeWrites(await getPeWrites(page)).map((w) => w.cmd)
  expect(cmds.slice(0, 21)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1))
})

test('采集波形渲染(通道 A/B)', async ({ page }) => {
  await page.addInitScript(fakeParamEstSerial())
  await page.goto('/param-est')
  await page.getByRole('button', { name: '连接串口' }).click()
  await page.getByTestId('test-1').click()
  await page.getByTestId('btn-start').click()

  await expect(page.getByTestId('res-Rs')).toHaveText(/0\.13/, { timeout: 8000 })
  await expect(page.getByTestId('wave-scope')).toBeVisible()
  expect(await page.locator('[data-testid="wave-scope"] path').count()).toBeGreaterThanOrEqual(2)
})

test('断开连接回到未连接', async ({ page }) => {
  await page.addInitScript(fakeParamEstSerial())
  await page.goto('/param-est')
  await page.getByRole('button', { name: '连接串口' }).click()
  await expect(page.getByText('已连接')).toBeVisible()

  await page.getByRole('button', { name: '断开' }).click()
  await expect(page.getByText('未连接')).toBeVisible()
  await expect(page.getByRole('button', { name: '连接串口' })).toBeVisible()
})

test('数据不可用 → 抛弃并显示「出现数据错误」', async ({ page }) => {
  await page.addInitScript(fakeParamEstSerial({ zero: true }))
  await page.goto('/param-est')

  await page.getByRole('button', { name: '连接串口' }).click()
  await page.getByTestId('test-1').click()
  await page.getByTestId('btn-start').click()

  await expect(page.getByTestId('data-error')).toHaveText('出现数据错误', { timeout: 8000 })
})
