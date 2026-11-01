import { test, expect } from '@playwright/test';

test.describe('SaaS POS Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const user = {
        id: 'e2e-user',
        tenantId: 'e2e-tenant',
        tenantName: 'Test Retail Store',
        name: 'Test Owner',
        email: 'owner@example.com',
        permissions: ['products.view'],
      };
      let data: unknown = {};

      if (pathname.endsWith('/auth/me')) {
        data = user;
      } else if (/\/auth\/(login|register)$/.test(pathname)) {
        data = { accessToken: 'e2e-access-token', user };
      } else if (pathname.endsWith('/reports/sales-summary')) {
        data = {
          totalSales: 0,
          totalRevenue: '0.00',
          totalTax: '0.00',
          totalDiscount: '0.00',
          averageOrderValue: '0.00',
          byStore: [],
          byPaymentMethod: {},
          topProducts: [],
        };
      } else if (pathname.endsWith('/reports/inventory')) {
        data = {
          totalItems: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          lowStockItems: [],
          items: [],
        };
      } else if (pathname.endsWith('/products')) {
        data = { items: [], total: 0 };
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
    });

    await page.goto('/');
  });

  test('should load the landing page', async ({ page }) => {
    await expect(page).toHaveTitle(/SaaS POS/);
    await expect(page.getByRole('heading', { name: /The Commerce Platform/i })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: "Don't have an account? Register" }).click();
    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: 'Register Tenant' })).toBeVisible();
  });

  test('should register a new tenant and redirect to dashboard', async ({ page }) => {
    await page.goto('/register');

    // Fill in the registration form
    await page.getByLabel('Tenant Name').fill('Test Retail Store');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Owner Name').fill('Test Owner');
    await page.getByLabel('Owner Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');

    // Submit the form
    await page.getByRole('button', { name: 'Register' }).click();

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL('/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('should login with existing credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in login form
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL('/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('should navigate to products page from dashboard', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/app/dashboard');

    // Navigate to products
    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL('/app/products');
    await expect(page.getByRole('heading', { name: 'Product Catalogue' })).toBeVisible();
  });
});
