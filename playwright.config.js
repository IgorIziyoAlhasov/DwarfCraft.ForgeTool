import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'qa',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { executablePath: process.env.FORGETOOL_CHROMIUM },
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
  },
});
