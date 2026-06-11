import { expect, test } from '@playwright/test'

test('data browser route shows validated datasets', async ({ page }) => {
  await page.goto('/#/debug/data')
  await expect(page.getByRole('heading', { name: 'Datenbrowser' })).toBeVisible()
  await expect(page.getByText('Kreuzvalidierung OK')).toBeVisible()
  await page.getByRole('button', { name: /vehicles/ }).click()
  await expect(page.getByRole('cell', { name: '5.71-202' })).toBeVisible()
})

test('app shell loads with title and disclaimer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'RLS-SIM Salzburg' })).toBeVisible()
  await expect(page.getByText('Rettungsleitstellen-Simulator')).toBeVisible()
  await expect(
    page.getByText('Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes.'),
  ).toBeVisible()
})
