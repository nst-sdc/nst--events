import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.ADMIN_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5440/nst_events?schema=public',
    },
  },
});

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

test.describe('Task 8: Web End-to-End Authentication Suite (Playwright)', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  // Scenario 1: Login -> sign out via student profile -> visit "/" -> click "Go to Events" -> lands on /login, NO silent sign-in.
  test('Scenario 1: Login -> sign out via student profile -> visit "/" -> click "Go to Events" -> lands on /login, NO silent sign-in', async ({
    context,
    page,
  }) => {
    const timestamp = Date.now();
    const studentEmail = `e2e-student-${timestamp}@adypu.edu.in`;
    const fullName = `E2E Student ${timestamp}`;

    // 1. Seed student in authorized directory and create user
    await prisma.authorizedStudent.create({
      data: {
        normalizedEmail: studentEmail,
        status: 'ACTIVE',
      },
    });

    const user = await prisma.user.create({
      data: {
        email: studentEmail,
        googleSub: `sub-e2e-student-${timestamp}`,
        fullName,
        globalRole: 'STUDENT',
      },
    });

    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // 2. Set authenticated session cookies
    await context.addCookies([
      {
        name: 'refreshToken',
        value: rawRefreshToken,
        domain: 'localhost',
        path: '/auth',
        httpOnly: true,
        sameSite: 'Strict',
      },
      {
        name: 'user_role',
        value: 'STUDENT',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        sameSite: 'Lax',
      },
    ]);

    // 3. Visit student profile and verify signed in
    await page.goto('http://localhost:3000/student/profile');
    await expect(page.locator('text=Student Portfolio & Privacy Settings')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=My Profile')).toBeVisible();

    // 4. Sign out via student profile
    const profileSignOutBtn = page.getByRole('button', { name: /sign out/i }).first();
    await expect(profileSignOutBtn).toBeVisible();
    await profileSignOutBtn.click();

    // Confirm modal opens
    const modalSignOutBtn = page.locator('div[role="dialog"] button:has-text("Sign Out")').or(
      page.locator('.fixed button:has-text("Sign Out")')
    );
    await expect(modalSignOutBtn).toBeVisible();
    await modalSignOutBtn.click();

    // 5. Must redirect to /login
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).toContain('/login');

    // 6. Visit "/" (public landing page)
    await page.goto('http://localhost:3000/');
    await expect(page.getByText('Newton School of Technology (NST)', { exact: true })).toBeVisible({ timeout: 10000 });
    expect(page.url()).toBe('http://localhost:3000/');

    // 7. Click "Go to Events"
    const goToEventsBtn = page.getByRole('link', { name: /Go to Events/i });
    await expect(goToEventsBtn).toBeVisible();
    await goToEventsBtn.click();

    // 8. Must land on /login with NO silent sign-in
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('return_to');

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
  });

  // Scenario 2: Same, signing out via the operations sidebar.
  test('Scenario 2: Login -> sign out via operations sidebar -> visit "/" -> click "Go to Events" -> lands on /login, NO silent sign-in', async ({
    context,
    page,
  }) => {
    const timestamp = Date.now();
    const adminEmail = `e2e-admin-${timestamp}@newtonschool.co`;
    const fullName = `E2E Admin ${timestamp}`;

    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        googleSub: `sub-e2e-admin-${timestamp}`,
        fullName,
        globalRole: 'PLATFORM_ADMIN',
      },
    });

    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Set authenticated session cookies for Admin
    await context.addCookies([
      {
        name: 'refreshToken',
        value: rawRefreshToken,
        domain: 'localhost',
        path: '/auth',
        httpOnly: true,
        sameSite: 'Strict',
      },
      {
        name: 'user_role',
        value: 'PLATFORM_ADMIN',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        sameSite: 'Lax',
      },
    ]);

    // 1. Visit operations dashboard
    await page.goto('http://localhost:3000/dashboard');
    await expect(page.locator('text=NST Events')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('OPERATIONS', { exact: true })).toBeVisible();

    // 2. Open user menu dropdown in AppShell header and click Sign Out
    const dropdownTrigger = page.locator('.ant-dropdown-trigger').first();
    await expect(dropdownTrigger).toBeVisible();
    await dropdownTrigger.click();

    const signOutMenuItem = page.locator('.ant-dropdown-menu-item:has-text("Sign Out")');
    await expect(signOutMenuItem).toBeVisible();
    await signOutMenuItem.click();

    // 3. Must redirect to /login
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).toContain('/login');

    // 4. Visit "/"
    await page.goto('http://localhost:3000/');
    await expect(page.getByText('Newton School of Technology (NST)', { exact: true })).toBeVisible({ timeout: 10000 });
    expect(page.url()).toBe('http://localhost:3000/');

    // 5. Click "Go to Events"
    const goToEventsBtn = page.getByRole('link', { name: /Go to Events/i });
    await expect(goToEventsBtn).toBeVisible();
    await goToEventsBtn.click();

    // 6. Must land on /login, NO silent sign-in
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('return_to');

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
  });

  // Scenario 5: Login -> reload page -> still signed in (bootstrap refresh works).
  test('Scenario 5: Login -> reload page -> still signed in (bootstrap refresh works)', async ({
    context,
    page,
  }) => {
    const timestamp = Date.now();
    const studentEmail = `e2e-reload-${timestamp}@adypu.edu.in`;
    const fullName = `E2E Reload Student ${timestamp}`;

    await prisma.authorizedStudent.create({
      data: {
        normalizedEmail: studentEmail,
        status: 'ACTIVE',
      },
    });

    const user = await prisma.user.create({
      data: {
        email: studentEmail,
        googleSub: `sub-e2e-reload-${timestamp}`,
        fullName,
        globalRole: 'STUDENT',
      },
    });

    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await context.addCookies([
      {
        name: 'refreshToken',
        value: rawRefreshToken,
        domain: 'localhost',
        path: '/auth',
        httpOnly: true,
        sameSite: 'Strict',
      },
      {
        name: 'user_role',
        value: 'STUDENT',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        sameSite: 'Lax',
      },
    ]);

    // 1. Visit student profile
    await page.goto('http://localhost:3000/student/profile');
    await expect(page.locator('text=Student Portfolio & Privacy Settings')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=My Profile')).toBeVisible();

    // 2. Reload the page
    await page.reload();

    // 3. Verify user remains signed in (bootstrap refresh restores in-memory access token)
    await expect(page.locator('text=Student Portfolio & Privacy Settings')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=My Profile')).toBeVisible();
    expect(page.url()).toContain('/student/profile');
    expect(page.url()).not.toContain('/login');

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
  });
});
