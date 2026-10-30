import { test, expect } from '@playwright/test';

test.describe('SaaS POS Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the landing page
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
