import { expect, test } from '@playwright/test'

test('window can be moved, layout persists across reload', async ({ page }) => {
  await page.goto('/#/spiel')
  const win = page.locator('[data-window-id="einsatzliste"]')
  await expect(win).toBeVisible()

  const before = await win.boundingBox()
  expect(before).not.toBeNull()

  // Drag the titlebar by (−160, +96)
  const titlebar = win.locator('.window-titlebar')
  const tb = await titlebar.boundingBox()
  await page.mouse.move(tb!.x + tb!.width / 2, tb!.y + tb!.height / 2)
  await page.mouse.down()
  await page.mouse.move(tb!.x + tb!.width / 2 - 160, tb!.y + tb!.height / 2 + 96, { steps: 8 })
  await page.mouse.up()

  const after = await win.boundingBox()
  expect(Math.round(after!.x)).not.toBe(Math.round(before!.x))

  // Autosave is debounced (250 ms) — wait, then reload and compare
  await page.waitForTimeout(600)
  await page.reload()
  await expect(win).toBeVisible()
  const restored = await win.boundingBox()
  expect(Math.round(restored!.x)).toBe(Math.round(after!.x))
  expect(Math.round(restored!.y)).toBe(Math.round(after!.y))
})

test('window minimize and close/reopen via taskbar', async ({ page }) => {
  await page.goto('/#/spiel')
  const win = page.locator('[data-window-id="funk"]')
  await expect(win).toBeVisible()

  await win.getByRole('button', { name: 'Funkfeld minimieren' }).click()
  await expect(page.getByTestId('funkfeld-panel')).toBeHidden()

  await win.getByRole('button', { name: 'Funkfeld wiederherstellen' }).click()
  await expect(page.getByTestId('funkfeld-panel')).toBeVisible()

  await win.getByRole('button', { name: 'Funkfeld schließen' }).click()
  await expect(win).toBeHidden()

  await page.getByRole('toolbar', { name: 'Fenster' }).getByRole('button', { name: 'Funkfeld' }).click()
  await expect(win).toBeVisible()
})

test('named layout preset can be saved', async ({ page }) => {
  await page.goto('/#/spiel')
  await page.getByLabel('Layout-Name').fill('Test-Layout')
  await page.getByRole('button', { name: 'Layout speichern' }).click()
  await expect(page.getByLabel('Layout laden')).toContainText('Test-Layout')
})
