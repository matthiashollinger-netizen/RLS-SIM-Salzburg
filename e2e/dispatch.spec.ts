import { expect, test } from '@playwright/test'

test('dispatch core: create incident, AO proposal, assign unit, timer visible', async ({
  page,
}) => {
  await page.goto('/#/spiel')
  const panel = page.getByTestId('einsatzliste-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Keine offenen Einsätze.')).toBeVisible()

  // create a test incident (debug generator until M5 calltaker exists)
  await panel.getByRole('button', { name: 'Neuer Einsatz (Test)' }).click()

  // list row with alarm text `CODE STADTTEIL STRASSE` and detail view appear
  const row = panel.locator('.einsatz-row').first()
  await expect(row).toBeVisible()
  await expect(row.locator('.code-chip')).toHaveText(/^(A\d|B\d|C\d|D\d|E\d|MANV\d)$/)

  const detail = page.getByTestId('auftrag-detail')
  await expect(detail).toBeVisible()
  await expect(detail.locator('.unit-slot').first()).toBeVisible()

  // partner toggles exist
  await expect(detail.getByRole('button', { name: 'FW', exact: true })).toBeVisible()

  // assign the best proposed unit
  const candidate = detail.locator('.unit-candidate').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  await expect(detail.locator('.assigned-unit').first()).toBeVisible()
  await expect(row).toContainText('disponiert')

  // hospital select offers ranked candidates with suitability markers
  const hospitalSelect = detail.getByLabel('Zielklinik')
  await expect(hospitalSelect).toBeVisible()
  const options = await hospitalSelect.locator('option').allTextContents()
  expect(options.length).toBeGreaterThan(3)
})

test('code override updates SoSi and Hilfsfrist', async ({ page }) => {
  await page.goto('/#/spiel')
  const panel = page.getByTestId('einsatzliste-panel')
  await panel.getByRole('button', { name: 'Neuer Einsatz (Test)' }).click()
  const detail = page.getByTestId('auftrag-detail')

  // override to B3 (no SoSi, no Hilfsfrist)
  await detail.getByLabel('Einsatzcode übersteuern').selectOption('B3')
  const row = panel.locator('.einsatz-row').first()
  await expect(row.locator('.code-chip')).toHaveText('B3')
  await expect(row.locator('.timer-none')).toBeVisible()

  // override to A1 (SoSi + 15-min timer runs)
  await detail.getByLabel('Einsatzcode übersteuern').selectOption('A1')
  await expect(row.locator('.code-chip')).toHaveText('A1')
  await expect(row.locator('.timer-run, .timer-warn')).toBeVisible()
  await expect(row.locator('.timer-run, .timer-warn')).toContainText(/^\d{1,2}:\d{2}$/)
})
