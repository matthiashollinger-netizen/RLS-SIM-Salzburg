import { expect, test } from '@playwright/test'

test('app shell loads with title and disclaimer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'RLS-SIM Salzburg' })).toBeVisible()
  await expect(page.getByText('Rettungsleitstellen-Simulator')).toBeVisible()
  await expect(
    page.getByText('Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes.'),
  ).toBeVisible()
})
