import { test } from '@playwright/test'

/** README screenshot generator — run with SCREENSHOTS=1, skipped in CI. */
test.describe('screenshots', () => {
  test.skip(process.env.SCREENSHOTS !== '1', 'set SCREENSHOTS=1 to generate')

  test('capture menu and game screen', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'docs/screenshots/hauptmenue.png' })

    await page.getByTestId('schicht-starten').click()
    await page.getByTestId('game-clock').waitFor()
    // create an incident and dispatch so the screen shows real content
    await page
      .getByTestId('einsatzliste-panel')
      .getByRole('button', { name: 'Neuer Einsatz (Test)' })
      .click()
    const detail = page.getByTestId('auftrag-detail')
    const candidate = detail.locator('.unit-candidate').first()
    if (await candidate.isVisible()) await candidate.click()
    await page.waitForTimeout(2500) // tiles + markers
    await page.screenshot({ path: 'docs/screenshots/leitstelle.png' })

    await page.goto('/#/editor')
    await page.getByTestId('editor-page').waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'docs/screenshots/editor.png' })
  })
})
