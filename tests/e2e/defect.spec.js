const { test, expect } = require('@playwright/test');

test.describe('DefectFlow MVP E2E Tests', () => {
    test.describe.configure({ mode: 'serial' });

    test('Home should show login screen when logged out', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Defect Manage/);
        await expect(page.getByRole('button', { name: '로그인' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible({ timeout: 15000 });
    });

    test('Should open standalone login flow from Test Bench', async ({ page, context }) => {
        // Navigate to Test Bench
        await page.goto('/test_view/test_view.html');

        // Click register button and wait for popup
        const [popup] = await Promise.all([
            context.waitForEvent('page'),
            page.click('text=신규 결함 등록')
        ]);

        await popup.waitForURL(/mode=standalone/);
        await popup.waitForLoadState('domcontentloaded');

        // Verify popup content
        await expect(popup.getByRole('button', { name: '로그인' })).toBeVisible({ timeout: 15000 });
        await expect(popup.getByRole('heading', { name: '환영합니다' })).toBeVisible({ timeout: 15000 });
        await expect(popup.getByText('로그인 후 신규 결함 등록 화면으로 자동 복귀합니다.')).toBeVisible({ timeout: 15000 });
    });
});
