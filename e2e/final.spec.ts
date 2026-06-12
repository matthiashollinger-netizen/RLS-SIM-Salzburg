import { expect, test } from '@playwright/test'

/**
 * Finale Smoke-Suite (CLAUDE.md M10 + Definition of Done): a person without
 * prior knowledge can play the tutorial shift end-to-end:
 * Menü → Tutorial → Anruf annehmen → Abfrage → Auftrag → Disposition →
 * Status/Funk → Schichtreport.
 */
test('definition of done: complete tutorial shift end-to-end', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')

  // main menu → tutorial
  await expect(page.getByTestId('hauptmenue')).toBeVisible()
  await page.getByTestId('tutorial-starten').click()
  const tutorial = page.getByTestId('tutorial-overlay')
  await expect(tutorial).toBeVisible()
  await expect(tutorial).toContainText('Willkommen')
  await tutorial.getByRole('button', { name: 'Weiter' }).click()

  // step: answer the guided call
  await expect(tutorial).toContainText('Nimm den Anruf')
  await page.getByRole('button', { name: 'Annehmen' }).click()

  // step: interview in the Gespräch window (geschehen + bewusstsein)
  await expect(tutorial).toContainText('Gespräch')
  const gespraech = page.getByTestId('gespraech-panel')
  const abfrage = page.getByTestId('abfrage-panel')
  await gespraech.getByRole('button', { name: 'Was genau ist passiert?' }).click()
  await gespraech.getByRole('button', { name: 'Ist die Person ansprechbar?' }).click()

  // step: note the answer in the official schema (manual noting, Rework 2)
  await expect(tutorial).toContainText('Notiere')
  await abfrage.locator('.janein-row', { hasText: 'Person ansprechbar?' }).getByRole('button', { name: 'Ja', exact: true }).click()

  // step: Hauptbeschwerde (inline grid in Schritt 2)
  await expect(tutorial).toContainText('Hauptbeschwerde')
  await page.getByTestId('beschwerde-grid').getByRole('button', { name: 'Brustschmerz' }).click()

  // step: create the Auftrag
  await expect(tutorial).toContainText('Auftrag anlegen')
  await page.getByTestId('auftrag-anlegen').click()

  // step: dispatch — stage the two proposed units (NA + RTW), then ALARMIEREN
  await expect(tutorial).toContainText('disponieren')
  const detail = page.getByTestId('auftrag-detail')
  const slots = detail.locator('.unit-slot')
  await expect(slots.first()).toBeVisible()
  await slots.nth(0).locator('.unit-candidate').first().click()
  await slots.nth(1).locator('.unit-candidate').first().click()
  await detail.getByTestId('alarmieren').click()

  // step: watch status flow — fast-forward via jump-to-event until arrival
  await expect(tutorial).toContainText('Beobachte Karte und Funkfeld')
  for (let i = 0; i < 8; i++) {
    if (await tutorial.getByText('Eintreffen gemeldet').isVisible()) break
    await page.getByRole('button', { name: 'Sprung zum nächsten Ereignis' }).click()
    await page.waitForTimeout(400)
  }
  await expect(tutorial).toContainText('Eintreffen gemeldet', { timeout: 30_000 })

  // interactive radio (Rework #4): the first unit CALLS — the player must
  // answer „kommen" and close with „Verstanden"
  const funk = page.getByTestId('funkfeld-panel')
  await expect(funk).toContainText(/von (Christophorus 6|[0-9]+-[0-9]+)/, { timeout: 10_000 })
  await funk.getByRole('button', { name: '„kommen"' }).first().click()
  await expect(funk.locator('.funk-spruch').first()).toContainText('kommen')
  await funk.getByRole('button', { name: '„Verstanden"' }).first().click()
  await expect(funk.locator('.funk-spruch').first()).toContainText('Verstanden')

  // finish tutorial + shift → report with grade
  await tutorial.getByRole('button', { name: 'Tutorial abschließen' }).click()
  await page.getByRole('button', { name: 'Schicht beenden' }).click()
  const report = page.getByTestId('schichtreport')
  await expect(report).toBeVisible()
  await expect(report).toContainText(/Note [1-5]/)
  await expect(report).toContainText('Hilfsfrist')

  // at least one achievement unlocks (several can fire on a perfect shift —
  // the toast shows the most recent)
  await expect(page.getByTestId('achievement-toast')).toContainText('Erfolg freigeschaltet')
})

test('editor exercise runs as ÜBUNG', async ({ page }) => {
  await page.goto('/#/editor')
  const editor = page.getByTestId('editor-page')
  await expect(editor).toBeVisible()

  // first incident fires 5 s into the exercise
  await editor.getByLabel('Einsatz 1 Zeitpunkt').fill('5')
  await page.getByTestId('uebung-starten').click()

  // the scripted call rings (5 sim seconds at 1×)
  const answerBtn = page.getByRole('button', { name: 'Annehmen' })
  await expect(answerBtn).toBeVisible({ timeout: 20_000 })
  await answerBtn.click()

  // create the Auftrag (Festnetz address prefilled) → marked as ÜBUNG
  await page.getByTestId('auftrag-anlegen').click()
  const row = page.getByTestId('einsatzliste-panel').locator('.einsatz-row').first()
  await expect(row).toBeVisible()
  // the new Auftrag is auto-selected — detail shows the ÜBUNG chip
  await expect(page.getByTestId('auftrag-detail').locator('.uebung-chip')).toBeVisible()
})

test('editor export produces a loadable JSON file', async ({ page }) => {
  await page.goto('/#/editor')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Als Datei exportieren' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('.rls-uebung.json')
})
