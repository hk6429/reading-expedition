import { defineConfig, devices } from "@playwright/test";

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 11)) {
  throw new Error("Playwright E2E 需要 Node.js 20.11 以上版本。");
}

const externalBaseURL = process.env.E2E_BASE_URL;
const localBaseURL = "http://127.0.0.1:41789";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: externalBaseURL ?? localBaseURL,
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "node scripts/e2e-static-server.mjs",
        url: localBaseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
