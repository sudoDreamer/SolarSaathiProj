import { expect, test } from '@playwright/test';
test('top Pages navigation connects public pages and stays reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Bills', exact: true })).toBeVisible();
  await nav.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('button', { name: 'Pages', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 1800));
  const header = page.locator('.site-header');
  expect((await header.boundingBox()).y).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('landing and a complete calculation work at desktop and mobile widths', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SolarSaathi.');
  await expect(page.locator('.hero-scene img')).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-landing.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Check my eligibility', exact: false }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Let’s find your solar potential.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Use example household' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A year of electricity use' })).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-calculator.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Shadow-free roof' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'See my solar estimate' }).click();
  await expect(page).toHaveURL(/\/result\//);
  await expect(page.locator('.capacity-number')).toHaveText('3.00');
  await expect(page.getByRole('button', { name: 'Sanctioned-load path' })).toBeVisible();
  await page.getByRole('button', { name: 'Sanctioned-load path' }).click();
  await expect(page.locator('.capacity-number')).toHaveText('4.50');
  await page.screenshot({ path: `test-results/${info.project.name}-result.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('reduced motion and keyboard skip stay usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.hero-reduced')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content/);
});
