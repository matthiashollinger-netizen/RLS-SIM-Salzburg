import { expect, test } from '@playwright/test'

test('game clock runs and can be paused', async ({ page }) => {
  await page.goto('/#/spiel')
  const clock = page.getByTestId('game-clock')
  await expect(clock).toBeVisible()
  const t1 = await clock.textContent()
  await expect.poll(() => clock.textContent(), { timeout: 10_000 }).not.toBe(t1)

  await page.getByRole('button', { name: '⏸' }).click()
  const t3 = await clock.textContent()
  await page.waitForTimeout(1200)
  expect(await clock.textContent()).toBe(t3)
})

test('resource monitor shows live fleet with status badges and dispatches a test alarm', async ({
  page,
}) => {
  await page.goto('/#/spiel')
  const panel = page.getByTestId('ressourcen-panel')
  await expect(panel).toBeVisible()

  // pick any vehicle that is ready (00) — shift-start Fahrzeugcheck (92) is random
  const readyRow = panel
    .locator('tbody tr')
    .filter({ has: page.locator('.status-badge', { hasText: /^00$/ }) })
    .first()
  await expect(readyRow).toBeVisible()
  const callSign = (await readyRow.locator('td').first().textContent())!.trim()
  // pin the row by call sign — the "00" filter is live and would jump rows after dispatch
  const row = panel.locator('tbody tr').filter({ hasText: callSign }).first()

  // select and send a Probealarm — status flips to 1 (Auftrag angenommen)
  await row.click()
  await expect(page.getByTestId('vehicle-actions')).toBeVisible()
  await page.getByRole('button', { name: 'Probealarm (ÜBUNG)' }).click()
  await expect(row.locator('.status-badge')).toHaveText('1')

  // the protocol logs the transition (Funkfeld is the radio dialogue since M7)
  await page.getByRole('toolbar', { name: 'Fenster' }).getByRole('button', { name: 'Protokoll' }).click()
  await expect(page.getByTestId('protokoll-panel')).toContainText(`${callSign} → Status 1`)
})

test('day-only vehicles are off duty outside their window', async ({ page }) => {
  await page.goto('/#/spiel')
  const panel = page.getByTestId('ressourcen-panel')
  // BTW fleet (Mo–Fr 06:00–18:00 etc.) is on duty at 07:30 default start
  await panel.getByLabel('Fahrzeuge filtern').fill('20-501')
  await expect(panel.getByRole('row').filter({ hasText: '20-501' })).toBeVisible()
  // Hof KTW (nights+weekends) must NOT be listed among active vehicles on Monday 07:30
  await panel.getByLabel('Fahrzeuge filtern').fill('45-301')
  await expect(panel.getByRole('row').filter({ hasText: '45-301' })).toHaveCount(0)
})
