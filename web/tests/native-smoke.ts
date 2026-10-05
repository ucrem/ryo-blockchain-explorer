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
    await page.getByRole("link", { name: "Block 0", exact: true }).waitFor();
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
    await page.getByRole("link", { name: "Block 0", exact: true }).click();
    await page.getByRole("heading", { name: "Block 0", exact: true }).waitFor();
    assert.ok(new URL(page.url()).pathname.startsWith("/blocks/"));
    await page.screenshot({
      path: "../build/v04-native-block.png",
      fullPage: true,
    });
    const coinbase =
      "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88";
    await page.locator(`a[href='/transactions/${coinbase}']`).first().click();
    await page
      .getByRole("heading", { name: "Transaction details", exact: true })
      .waitFor();
    await page.getByText("8,800,000.000000000 RYO", { exact: true }).waitFor();
    await page.screenshot({
      path: "../build/v04-native-transaction.png",
      fullPage: true,
    });
    for (const [identifier, destination] of [
      ["0", "/blocks/0"],
      [network.data.tip.hash.toUpperCase(), `/blocks/${network.data.tip.hash}`],
      [coinbase, `/transactions/${coinbase}`],
    ]) {
      await page
        .getByLabel("Search the Ryo blockchain", { exact: true })
        .fill(identifier);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL((url) => url.pathname === destination);
    }
    assert.deepEqual([...origins], [new URL(base).origin]);
    assert.deepEqual(errors, []);
    console.log(
      "Production frontend / native offline LMDB / block and transaction HTML / search / raw and OpenAPI smoke passed.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
