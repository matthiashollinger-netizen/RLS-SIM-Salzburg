import { expect, test } from '@playwright/test'

test('main menu starts a configured shift in the south', async ({ page }) => {
  await page.goto('/')
  const menu = page.getByTestId('hauptmenue')
  await expect(menu).toBeVisible()

  await menu.getByRole('button', { name: 'SÜD — Zell am See' }).click()
  await menu.getByRole('button', { name: '8h-Schicht' }).click()
  await menu.getByRole('button', { name: 'Entspannt' }).click()
  await menu.getByLabel('Monat').selectOption('1') // winter
  await page.getByTestId('schicht-starten').click()

  // game starts at 07:00 with the south fleet (Zell NEF in service)
  await expect(page.getByTestId('game-clock')).toContainText('07:0')
  const panel = page.getByTestId('ressourcen-panel')
  await panel.getByLabel('Fahrzeuge filtern').fill('10-107')
  await expect(panel.getByRole('row').filter({ hasText: '10-107' })).toBeVisible()
  // winter helicopter Martin 10 exists — but at 07:00 in January the sun is
  // not up yet (sunrise ~07:54), so it is off duty: only visible with "a. D."
  await panel.getByLabel('Fahrzeuge filtern').fill('Martin 10')
  await expect(panel.getByRole('row').filter({ hasText: 'Martin 10' })).toHaveCount(0)
  await panel.locator('.panel-checkbox input').check()
  await expect(panel.getByRole('row').filter({ hasText: 'Martin 10' })).toBeVisible()
})

test('time jump advances the clock', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('schicht-starten').click()
  const clock = page.getByTestId('game-clock')
  await expect(clock).toBeVisible()
  const before = await clock.textContent()
  await page.getByRole('button', { name: 'Sprung zum nächsten Ereignis' }).click()
  await expect.poll(() => clock.textContent(), { timeout: 15_000 }).not.toBe(before)
})

test('ending the shift shows the report with score dimensions', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('schicht-starten').click()
  await expect(page.getByTestId('game-clock')).toBeVisible()

  // create + close one incident so the report has content
  const einsatz = page.getByTestId('einsatzliste-panel')
  await einsatz.getByRole('button', { name: 'Neuer Einsatz (Test)' }).click()
  await page.getByTestId('auftrag-detail').getByRole('button', { name: 'Auftrag abschließen' }).click()

  await page.getByRole('button', { name: 'Schicht beenden' }).click()
  const report = page.getByTestId('schichtreport')
  await expect(report).toBeVisible()
  await expect(report).toContainText('Hilfsfrist')
  await expect(report).toContainText('Stichwortgenauigkeit')
  await expect(report).toContainText('Fehldispositionen')
  await expect(report).toContainText(/Note [1-5]/)

  // back to the main menu
  await report.getByRole('button', { name: 'Zum Hauptmenü' }).click()
  await expect(page.getByTestId('hauptmenue')).toBeVisible()
})

test('AI dispatcher assigns units when playing calltaker role', async ({ page }) => {
  await page.goto('/')
  const menu = page.getByTestId('hauptmenue')
  await menu.getByRole('button', { name: 'Calltaker (KI disponiert)' }).click()
  await page.getByTestId('schicht-starten').click()

  // player creates an incident (as if from a call) — AI should dispatch within ~20s sim
  await page.getByTestId('einsatzliste-panel').getByRole('button', { name: 'Neuer Einsatz (Test)' }).click()
  await page.getByRole('button', { name: '4×' }).click()
  const row = page.getByTestId('einsatzliste-panel').locator('.einsatz-row').first()
  await expect(row).toContainText(/disponiert|laufend/, { timeout: 20_000 })
})
