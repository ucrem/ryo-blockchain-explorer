// Run against a production frontend connected to a disposable genesis-only API.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
async function main() {
  const base = process.env.NATIVE_SMOKE_URL ?? "http://127.0.0.1:3112";
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
    });
    const errors: string[] = [];
    const origins = new Set<string>();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => origins.add(new URL(request.url()).origin));
    await page.goto(base);
    await page.getByText("Genesis · time not recorded").waitFor();
    await page.getByText("Beginning of the chain").waitFor();
    await page.getByRole("link", { name: "Block 0 JSON" }).waitFor();
    const result = await page.request.get(`${base}/api/v2/network`);
    assert.equal(result.status(), 200);
    const network = await result.json();
    assert.equal(network.meta.chain_height, "1");
    assert.equal(network.data.tip.height, "0");
    assert.equal(
      network.data.tip.hash,
      "6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac",
    );
    assert.equal(network.data.explorer_version, "0.4.0");
    const raw = await page.request.get(`${base}/api/v2/raw/block/0`);
    assert.equal(raw.status(), 200);
    const data = await raw.json();
    assert.equal(data.data.hash, network.data.tip.hash);
    assert.ok(/^[0-9a-f]+$/.test(data.data.blob_hex));
    const specification = await page.request.get(`${base}/api/v2/openapi.json`);
    assert.equal((await specification.json()).info.version, "0.4.0");
    assert.deepEqual([...origins], [new URL(base).origin]);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: "../build/v04-native-dashboard.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await page.locator("html.dark").waitFor();
    await page.reload();
    await page.getByText("Genesis · time not recorded").waitFor();
    await page.evaluate(() => document.fonts.ready);
    // Wait for the theme and self-hosted fonts to finish painting before capture.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await page.screenshot({
      path: "../build/v04-native-dashboard-dark.png",
      fullPage: true,
    });
    console.log(
      "Production frontend / native offline LMDB / raw and OpenAPI smoke passed.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
