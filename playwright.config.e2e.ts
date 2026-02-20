import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for A2UI React
 */
export default defineConfig({
  testDir: './src/canvas-host/a2ui-react/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.A2UI_REACT_URL || 'http://localhost:18789/__openclaw__/a2ui/react',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'node -e "require(`http`).createServer((req, res) => { const fs = require(`fs`); const path = require(`path`); const url = req.url === `/` ? `/index.html` : req.url; const filePath = path.join(`src/canvas-host/a2ui-react/dist`, url); fs.readFile(filePath).then(data => { const ext = path.extname(filePath); const mime = {`.html`:`text/html`,`.js`:`application/javascript`,`.css`:`text/css`}[ext]||`application/octet-stream`; res.writeHead(200, {\"Content-Type\": mime}); res.end(data); }).catch(() => { res.writeHead(404); res.end(`Not Found`}); }).listen(18789);"',
    port: 18789,
    timeout: 120000,
  },
});
