import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const drawboardURL = process.env.PLAYWRIGHT_DRAWBOARD_URL || "http://127.0.0.1:3500";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
  },
  webServer: [
    {
      command: "npm run dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm --prefix drawBoard run dev -- --host 127.0.0.1",
      url: drawboardURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
