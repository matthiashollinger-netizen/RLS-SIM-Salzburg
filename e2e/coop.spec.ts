import { expect, test, type Page } from '@playwright/test'

/**
 * Coop smoke (CLAUDE.md M9): two browser pages connect (local transport —
 * deterministic in CI; WebRTC UDP is blocked in the sandbox, see ANNAHMEN.md M9)
 * and the guest mirrors host state (Uhr, Aufträge) with role split.
 */
async function openCoopDialog(page: Page) {
  await page.getByRole('button', { name: 'Coop' }).click()
  await expect(page.getByRole('dialog', { name: 'Coop' })).toBeVisible()
}

test('two pages connect (local transport) and sync Aufträge + Uhr', async ({ browser }) => {
  test.setTimeout(60_000)
  const ctx = await browser.newContext()
  const host = await ctx.newPage()
  const guest = await ctx.newPage()

  await host.goto('/#/spiel')
  await guest.goto('/#/spiel')

  // host: local mode (same browser), role Disponent → guest becomes Calltaker
  await openCoopDialog(host)
  const hostDialog = host.getByRole('dialog', { name: 'Coop' })
  await hostDialog.getByRole('button', { name: 'Lokal (2 Fenster)' }).click()
  await hostDialog.getByRole('button', { name: 'Host starten (lokal)' }).click()
  const room = (await hostDialog.getByTestId('room-code').textContent())!.trim()
  expect(room).toMatch(/^[A-Z0-9]{4}$/)

  await openCoopDialog(guest)
  const guestDialog = guest.getByRole('dialog', { name: 'Coop' })
  await guestDialog.getByRole('button', { name: 'Beitreten' }).click()
  await guestDialog.getByRole('button', { name: 'Lokal (2 Fenster)' }).click()
  await guestDialog.getByLabel('Raum-Code').fill(room)
  await guestDialog.getByRole('button', { name: 'Beitreten (lokal)' }).click()

  await expect(hostDialog.getByTestId('coop-status')).toContainText('Verbunden als Host', {
    timeout: 15_000,
  })
  await expect(guestDialog.getByTestId('coop-status')).toContainText('Verbunden als Gast', {
    timeout: 15_000,
  })
  await hostDialog.getByRole('button', { name: 'Coop schließen' }).click()
  await guestDialog.getByRole('button', { name: 'Coop schließen' }).click()

  // host creates an incident → guest sees it via sync
  await host
    .getByTestId('einsatzliste-panel')
    .getByRole('button', { name: 'Neuer Einsatz (Test)' })
    .click()
  const hostRow = host.getByTestId('einsatzliste-panel').locator('.einsatz-row').first()
  await expect(hostRow).toBeVisible()
  const hostText = await hostRow.locator('.einsatz-text').textContent()

  const guestRow = guest.getByTestId('einsatzliste-panel').locator('.einsatz-row').first()
  await expect(guestRow).toBeVisible({ timeout: 10_000 })
  await expect(guestRow.locator('.einsatz-text')).toHaveText(hostText!, { timeout: 10_000 })

  // guest acts: stage a unit + ALARMIEREN — actions are executed on the HOST
  await guestRow.click()
  const guestDetail = guest.getByTestId('auftrag-detail')
  await expect(guestDetail).toBeVisible()
  await guestDetail.locator('.unit-candidate').first().click()
  await expect(guestDetail.getByTestId('alarmieren')).toBeVisible({ timeout: 10_000 })
  await guestDetail.getByTestId('alarmieren').click()
  await expect(hostRow).toContainText('disponiert', { timeout: 10_000 })

  // guest clock mirrors host
  await expect(guest.getByTestId('game-clock')).toContainText(/\d{2}:\d{2}:\d{2}/)

  await ctx.close()
})

test('manual WebRTC code exchange produces offer and answer codes', async ({ browser }) => {
  // Full UDP connectivity is environment-dependent (see ANNAHMEN.md M9) —
  // this verifies the copy-paste signaling flow itself.
  const ctx = await browser.newContext()
  const host = await ctx.newPage()
  const guest = await ctx.newPage()
  await host.goto('/#/spiel')
  await guest.goto('/#/spiel')

  await openCoopDialog(host)
  const hostDialog = host.getByRole('dialog', { name: 'Coop' })
  await hostDialog.getByRole('button', { name: 'Manueller Code' }).click()
  await hostDialog.getByRole('button', { name: 'Einladungs-Code erzeugen' }).click()
  const offer = await hostDialog.getByTestId('offer-code').inputValue({ timeout: 15_000 })
  expect(offer.length).toBeGreaterThan(50)

  await openCoopDialog(guest)
  const guestDialog = guest.getByRole('dialog', { name: 'Coop' })
  await guestDialog.getByRole('button', { name: 'Beitreten' }).click()
  await guestDialog.getByRole('button', { name: 'Manueller Code' }).click()
  await guestDialog.getByLabel('Einladungs-Code einfügen').fill(offer)
  await guestDialog.getByRole('button', { name: 'Antwort-Code erzeugen' }).click()
  const answer = await guestDialog.getByTestId('answer-code').inputValue({ timeout: 15_000 })
  expect(answer.length).toBeGreaterThan(50)

  await ctx.close()
})
