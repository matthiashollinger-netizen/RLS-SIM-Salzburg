import { expect, test } from '@playwright/test'

test('calltaker flow: answer call, interview, create Auftrag in dispatch list', async ({
  page,
}) => {
  await page.goto('/#/spiel')

  // deterministic demo call (Festnetz, Brustschmerz, address known)
  await page.getByTestId('anruf-queue').getByRole('button', { name: 'Test-Anruf' }).click()
  const answerBtn = page.getByRole('button', { name: 'Annehmen' })
  await expect(answerBtn).toBeVisible()
  await answerBtn.click()

  const abfrage = page.getByTestId('abfrage-panel')
  await expect(abfrage).toBeVisible()
  // greeting transcript + prefilled Festnetz address
  await expect(page.getByTestId('transcript')).toContainText('Rettungsleitstelle Salzburg')
  await expect(page.getByTestId('adresse-value')).toContainText('Festnetz-Anschlussdaten')

  // ask the standardized questions
  await abfrage.getByRole('button', { name: 'Was genau ist passiert?' }).click()
  await abfrage.getByRole('button', { name: 'Wie viele Personen sind betroffen?' }).click()
  await abfrage.getByRole('button', { name: 'Ist die Person ansprechbar?' }).click()
  await abfrage.getByRole('button', { name: 'Atmet die Person normal?' }).click()
  await expect(page.getByTestId('transcript')).toContainText('Brust')

  // pick the Hauptbeschwerde (grid is inline in Schritt 2 of the wizard)
  await page.getByTestId('beschwerde-grid').getByRole('button', { name: 'Brustschmerz' }).click()

  // Merkmalskette preview shows interview facts
  await expect(abfrage.locator('.merkmalskette-preview')).toContainText('medizinischer Notruf')

  // create the Auftrag — appears in the dispatch list with an alarm text
  await page.getByTestId('auftrag-anlegen').click()
  await expect(page.getByTestId('auftrag-anlegen')).toContainText('angelegt ✓')
  const row = page.getByTestId('einsatzliste-panel').locator('.einsatz-row').first()
  await expect(row).toBeVisible()
  await expect(row.locator('.code-chip')).toHaveText(/^(A1|B1)$/)

  // hang up ends the call
  await abfrage.getByRole('button', { name: 'Auflegen' }).click()
  await expect(page.getByTestId('abfrage-panel').getByText('Kein aktives Gespräch.')).toBeVisible()
})

test('address fuzzy search sets the Einsatzort', async ({ page }) => {
  await page.goto('/#/spiel')
  await page.getByTestId('anruf-queue').getByRole('button', { name: 'Test-Anruf' }).click()
  await page.getByRole('button', { name: 'Annehmen' }).click()

  const abfrage = page.getByTestId('abfrage-panel')
  await abfrage.getByLabel('Adresse suchen').fill('lehen ignaz')
  await abfrage.getByRole('button', { name: /Ignaz-Harrer-Straße/ }).click()
  await expect(page.getByTestId('adresse-value')).toContainText('Ignaz-Harrer-Straße')
  await expect(page.getByTestId('adresse-value')).toContainText('Lehen')
})
