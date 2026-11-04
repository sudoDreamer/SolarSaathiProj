import { expect, test } from '@playwright/test';
test('local login, household, bill entry and comparison work', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mobile = '8' + String(Date.now()).slice(-9);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-login.png`, fullPage: true });
  await page.getByRole('textbox', { name: /Mobile number/ }).fill(mobile);
  await page.getByRole('button', { name: 'Get login code' }).click();
  const code = await page.getByTestId('dev-otp').innerText();
  await page.getByRole('checkbox', { name: 'I agree' }).check();
  await page.locator('input[autocomplete="one-time-code"]').first().fill(code);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole('heading', { name: 'Your first brighter possibility.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore a labelled example home' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Example Pune home' })).toBeVisible();
  await page.getByRole('link', { name: 'Add my first bill' }).click();
  await page.getByRole('button', { name: 'Add a bill', exact: true }).click();
  await page.getByLabel('Bill month', { exact: true }).fill('2026-09');
  await page.getByRole('spinbutton', { name: 'Units consumed', exact: true }).fill('450');
  await page.getByRole('spinbutton', { name: 'Bill amount', exact: true }).fill('4200');
  await page.getByRole('button', { name: 'Save bill' }).click();
  await expect(page.getByRole('rowheader', { name: '2026-09', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add a bill', exact: true }).click();
  await page.getByLabel('Bill month', { exact: true }).fill('2026-10');
  await page.getByRole('spinbutton', { name: 'Units consumed', exact: true }).fill('400');
  await page.getByRole('spinbutton', { name: 'Bill amount', exact: true }).fill('3500');
  await page.getByRole('button', { name: 'Save bill' }).click();
  await expect(page.getByRole('rowheader', { name: '2026-10', exact: true })).toBeVisible();
  // Changes must survive a fresh GET, not just an update to React state.
  const october = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '2026-10', exact: true }) });
  await october.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Bill amount', exact: true }).fill('3600');
  await page.getByRole('button', { name: 'Save bill' }).click();
  await page.reload();
  await expect(october.getByText('₹3,600', { exact: true })).toBeVisible();
  await october.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(october).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(october).toHaveCount(1);
  await october.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Bill amount', exact: true }).fill('3500');
  await page.getByRole('button', { name: 'Save bill' }).click();
  await page.getByRole('link', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('heading', { name: '₹700 lower.' })).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-compare.png`, fullPage: true });
  await page.getByRole('link', { name: 'Application', exact: true }).click();
  await page
    .getByLabel('National portal application number', { exact: true })
    .fill('LOCAL-EXAMPLE-123');
  await page.getByRole('button', { name: 'Save progress' }).click();
  await expect(page.getByRole('status')).toHaveText('Application tracker saved.');
  await page.reload();
  await expect(page.getByLabel('National portal application number', { exact: true })).toHaveValue(
    'LOCAL-EXAMPLE-123',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
