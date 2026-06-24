const { defineConfig, devices } = require('@playwright/test');
const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT || '3001';
const PLAYWRIGHT_BASE_URL = `http://localhost:${PLAYWRIGHT_PORT}`;

module.exports = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: PLAYWRIGHT_BASE_URL,
        trace: 'on-first-retry',
        video: 'on',
        screenshot: 'on',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: `cross-env PORT=${PLAYWRIGHT_PORT} node server.js`,
        url: PLAYWRIGHT_BASE_URL,
        reuseExistingServer: false,
        timeout: 120 * 1000,
    },
});
