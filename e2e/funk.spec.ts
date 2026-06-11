import { expect, test } from '@playwright/test'

test('active radio call follows the Salzburg protocol (GAME_DATA §10c)', async ({ page }) => {
  await page.goto('/#/spiel')
  const funk = page.getByTestId('funkfeld-panel')
  await expect(funk).toBeVisible()

  // pick a 24h NEF and ask for its status via quick phrase
  const select = funk.getByLabel('Fahrzeug anfunken')
  await select.selectOption('5.10-107')
  await funk.getByRole('button', { name: 'Status?', exact: true }).click()

  const spruch = funk.locator('.funk-spruch').last()
  // protocol: called party first ("10-107 von Leitstelle"), then "kommen",
  // short call sign WITHOUT the 5. prefix, ends with "Verstanden"
  await expect(spruch).toContainText('10-107 von Leitstelle')
  await expect(spruch).toContainText('kommen')
  await expect(spruch).toContainText(/Status (00|92)/)
  await expect(spruch).toContainText('Verstanden')
  await expect(spruch).not.toContainText('5.10-107')
})

test('free-text radio call gets a template reply without LLM', async ({ page }) => {
  await page.goto('/#/spiel')
  const funk = page.getByTestId('funkfeld-panel')
  const select = funk.getByLabel('Fahrzeug anfunken')
  await select.selectOption({ index: 1 })
  await funk.getByLabel('Funkspruch Freitext').fill('Wie ist die Lage bei euch?')
  await funk.getByRole('button', { name: 'Senden' }).click()
  await expect(funk.locator('.funk-spruch').last()).toContainText('Wie ist die Lage bei euch?')
  await expect(funk.locator('.funk-spruch').last()).toContainText('Verstanden')
})

test('Anfunken from the resource monitor preselects the unit', async ({ page }) => {
  await page.goto('/#/spiel')
  const panel = page.getByTestId('ressourcen-panel')
  const row = panel.locator('tbody tr').first()
  await row.click()
  await page.getByTestId('vehicle-actions').getByRole('button', { name: 'Anfunken' }).click()
  const select = page.getByTestId('funkfeld-panel').getByLabel('Fahrzeug anfunken')
  await expect(select).not.toHaveValue('')
})
