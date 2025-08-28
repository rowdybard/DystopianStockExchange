import { test, expect } from '@playwright/test';

test('market loads and user can join and vote', async ({ page }) => {
  const appUrl = process.env.E2E_APP_URL || 'http://localhost:3001';
  await page.goto(appUrl);

  // Market loads (auto-register may create first citizen)
  await page.waitForSelector('.container');

  // If Join button exists, click it
  const joinBtn = page.locator('button:has-text("Join Market")');
  if (await joinBtn.count()) {
    await joinBtn.click();
  }

  // Click first citizen card
  const firstCitizen = page.locator('.card.citizen').first();
  await firstCitizen.click();

  // Affirm vote
  await page.waitForSelector('button:has-text("Affirm")');
  const indexBefore = await page.locator('.big-index').innerText();
  await page.locator('button:has-text("Affirm")').click();
  await expect(page.locator('.toasts .toast')).toContainText('Affirmed', { timeout: 10_000 });

  // Index should update eventually
  await page.waitForTimeout(1500);
  const indexAfter = await page.locator('.big-index').innerText();
  expect(indexAfter).not.toBe(indexBefore);
});


