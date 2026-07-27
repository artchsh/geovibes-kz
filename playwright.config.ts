import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:8081",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
  webServer: {
    command: "npm run web -- --port 8081",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
