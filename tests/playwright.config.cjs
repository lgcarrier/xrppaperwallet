const { defineConfig } = require('@playwright/test');
const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
const channel = process.env.PLAYWRIGHT_CHANNEL;

module.exports = defineConfig({
  testDir: __dirname,
  outputDir: '../output/playwright',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  fullyParallel: false,
  // Credentials are disposable, but should never enter automatic traces/reports.
  reporter: 'line',
  use: {
    headless: true,
    screenshot: 'off', video: 'off', trace: 'off',
  },
  projects: [
    {
      name: 'browser', testMatch: 'wallet.spec.cjs', outputDir: `../output/playwright/${browserName}`,
      use: { browserName, ...(browserName === 'chromium' && channel ? { channel } : {}) },
    },
    {
      name: 'print', testMatch: 'print.spec.cjs', outputDir: '../output/playwright/print',
      use: { browserName: 'chromium', ...(channel ? { channel } : {}) },
    },
  ],
});
