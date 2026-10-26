import { expect, test, type Page } from '@playwright/test';

test('the welcome screen offers log in and sign up', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Log In', { exact: true })).toBeVisible();
  await expect(page.getByText('Sign Up', { exact: true })).toBeVisible();
});

test('the privacy notice opens from a direct link', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Notice' })).toBeVisible();
});

// One new driver, used by every test below in order.
test.describe.serial('a new driver', () => {
  let page: Page;
  const id = `e2e_${Date.now().toString(36)}`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('signs up and lands on the map', async () => {
    await page.goto('/sign-up');
    await page.getByLabel('Username').fill(id);
    await page.getByLabel('Email', { exact: true }).fill(`${id}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('fuelwards1');
    await page.getByLabel('Re-type password', { exact: true }).fill('fuelwards1');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await expect(page.getByPlaceholder('Search station, brand or street')).toBeVisible();
  });

  test('finds a station and opens its details', async () => {
    await page.getByPlaceholder('Search station, brand or street').fill('petron');
    await page
      .getByRole('button', { name: /Petron/ })
      .first()
      .click();
    // The first tap selects the station's card; tapping the selected card opens the details.
    await page.locator('[aria-selected="true"]').first().click();
    await expect(page).toHaveURL(/\/station\//);
    await expect(page.getByText('Current prices')).toBeVisible();
    await expect(page.getByText('Last 30 days')).toBeVisible();
  });

  test('offers Google Maps and Waze for directions', async () => {
    await page.getByRole('button', { name: 'Directions' }).click();
    await expect(page.getByRole('button', { name: 'Waze' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('sets a price alert', async () => {
    await page.goto('/alerts');
    await page.getByRole('button', { name: 'Diesel', exact: true }).click();
    await page.getByLabel('Maximum price per litre').fill('55');
    await page.getByRole('button', { name: 'Save alert' }).click();
    await expect(page.getByText(/Diesel at or below/)).toBeVisible();
  });

  test('sees badges and can switch to Filipino', async () => {
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Badges' })).toBeVisible();
    await expect(page.getByText('Download my data')).toBeVisible();
    await page.getByRole('radio', { name: 'Filipino' }).click();
    await expect(page.getByText('Wika')).toBeVisible();
    await page.getByRole('radio', { name: 'System' }).last().click();
  });

  test('cannot open the admin console', async () => {
    await page.goto('/admin');
    await expect(page.getByText('Admins only')).toBeVisible();
  });
});
