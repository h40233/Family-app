import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev -- -p 3000",
    env: {
      ...process.env,
      FAMILY_OS_DATA_SOURCE: "memory"
    },
    url: "http://localhost:3000/api/v1/health",
    reuseExistingServer: true,
    timeout: 180_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
