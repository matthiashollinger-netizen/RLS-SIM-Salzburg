import { expect, test } from '@playwright/test'

// CI has no GPU: the mock engine replaces WebLLM (localStorage flag, CLAUDE.md M6)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rls-llm-mock', '1'))
})

test('settings: activate (mock) WebLLM caller and chat free-text', async ({ page }) => {
  await page.goto('/#/spiel')

  // open settings, switch to WebLLM, load model (mock loads instantly)
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  const dialog = page.getByRole('dialog', { name: 'Einstellungen' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('WebLLM (lokal im Browser)').check()
  await dialog.getByRole('button', { name: 'Modell laden' }).click()
  await expect(page.getByTestId('llm-status')).toContainText('KI-Anrufer aktiv')

  // TTS toggle exists
  await expect(dialog.getByText(/Anrufer vorlesen/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Einstellungen schließen' }).click()

  // take a call and ask a free-text question → mock LLM answers
  await page.getByTestId('anruf-queue').getByRole('button', { name: 'Test-Anruf' }).click()
  await page.getByRole('button', { name: 'Annehmen' }).click()
  const abfrage = page.getByTestId('gespraech-panel')
  await abfrage.getByLabel('Freitext-Frage').fill('Wo genau ist der Notfallort?')
  await abfrage.getByRole('button', { name: 'Fragen' }).click()
  await expect(page.getByTestId('transcript')).toContainText('MOCK')

  // structured question buttons also route through the (mock) LLM
  await abfrage.getByRole('button', { name: 'Atmet die Person normal?' }).click()
  await expect(page.getByTestId('transcript')).toContainText('atmen tut er')
})

test('light mode stays fully playable with free text (Tier-1 classifier)', async ({ page }) => {
  await page.goto('/#/spiel')
  await page.getByTestId('anruf-queue').getByRole('button', { name: 'Test-Anruf' }).click()
  await page.getByRole('button', { name: 'Annehmen' }).click()
  const abfrage = page.getByTestId('gespraech-panel')
  await abfrage.getByLabel('Freitext-Frage').fill('Was ist denn genau passiert?')
  await abfrage.getByRole('button', { name: 'Fragen' }).click()
  // Tier-1 answers from the scenario truth (Brustschmerz demo)
  await expect(page.getByTestId('transcript')).toContainText(/Brust|Druck/)
})
