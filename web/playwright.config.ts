import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  },
  webServer: [
    {
      command: "npx tsx tests/fixture-server.ts",
      url: "http://127.0.0.1:3101/__control",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      env: {
        RYO_API_URL: "http://127.0.0.1:3101",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
