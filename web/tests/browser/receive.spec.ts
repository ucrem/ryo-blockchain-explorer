import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const fixtures = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/receive.json"), "utf8"));
const find = (name: string) => fixtures.find((item: { name: string }) => item.name === name).request;
const good = find("v3-kind0");
test.beforeEach(async ({ request }) => { await request.get("http://127.0.0.1:3101/__control?mode=normal"); });

test("received outputs decode locally with exact amounts, clear secrets and emit only public hash requests", async ({ page, request }) => {
  const traffic: string[] = [], messages: string[] = [];
  page.on("request", (req) => traffic.push(JSON.stringify({ url: req.url(), headers: req.headers(), body: req.postData() })));
  page.on("console", (msg) => messages.push(msg.text()));
  page.on("pageerror", (error) => messages.push(error.message));
  await page.goto(`/tools/receive?tx=${good.hash}`);
  await expect(page.getByLabel("Private view key", { exact: true })).toBeDisabled();
  await page.getByLabel("Receiving Ryo address").fill(good.address);
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByLabel("Private view key", { exact: true })).toBeEnabled();
  await page.getByLabel("Private view key", { exact: true }).fill(good.view_key);
  await page.getByRole("button", { name: "Verify received outputs", exact: true }).click();
  const result = page.getByRole("region", { name: "Received output result" });
  await expect(result).toBeVisible();
  await expect(result.locator("tbody tr")).toHaveCount(2);
  await expect(result).toContainText("9,007,199.254740993 RYO");
  await expect(result).toContainText("0.000000000 RYO");
  await expect(page.getByLabel("Private view key", { exact: true })).toHaveValue("");
  await expect(result).not.toContainText("12.345678901 RYO"); // Other recipient.
  const server = await (await request.get("http://127.0.0.1:3101/__control")).json();
  const captured = JSON.stringify({ traffic, server: server.observed, messages });
  for (const value of [good.address, good.view_key, "9007199254740993", "9,007,199.254740993"])
    expect(captured).not.toContain(value);
  expect(messages).toEqual([]);
  for (const url of traffic) expect(url).toContain("http://127.0.0.1:3100");
  expect(server.observed.filter((req: { url: string }) => req.url.startsWith("/api/v2/raw/transaction/"))).toHaveLength(1);
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie, url: location.href }));
  expect(stored).not.toContain(good.address); expect(stored).not.toContain(good.view_key);
  await expect(page.getByLabel("Private view key", { exact: true })).not.toHaveAttribute("name");
  expect(await page.getByLabel("Private view key", { exact: true }).evaluate((input) => input.closest("form"))).toBeNull();
  if (process.env.RYO_CAPTURE_DOCS) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(process.env.RYO_CAPTURE_DOCS, "local-receive-desktop.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(400); // Wait for the existing theme transition.
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: resolve(process.env.RYO_CAPTURE_DOCS, "local-receive-dark.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: resolve(process.env.RYO_CAPTURE_DOCS, "local-receive-mobile.png"), fullPage: true });
  }
  await page.getByRole("button", { name: "Clear inputs and results" }).click();
  await expect(result).toHaveCount(0);
  await expect(page.getByLabel("Receiving Ryo address")).toHaveValue("");
  await expect(page.getByLabel("Transaction hash", { exact: true })).toHaveValue("");
});

test("invalid keys and unsafe Kurz addresses fail locally before chain requests", async ({ page, request }) => {
  await page.goto("/tools/receive");
  await page.getByLabel("Receiving Ryo address").fill(find("kurz-address").address);
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByRole("status")).toContainText("spending access");
  await expect(page.getByLabel("Private view key", { exact: true })).toBeDisabled();
  await page.getByLabel("Receiving Ryo address").fill(good.address);
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByLabel("Private view key", { exact: true })).toBeEnabled();
  await page.getByLabel("Transaction hash", { exact: true }).fill(good.hash);
  await page.getByLabel("Private view key", { exact: true }).fill(find("wrong-view-key").view_key);
  await page.getByRole("button", { name: "Verify received outputs", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("does not match");
  await expect(page.getByLabel("Private view key", { exact: true })).toHaveValue("");
  const server = await (await request.get("http://127.0.0.1:3101/__control")).json();
  expect(server.observed.filter((req: { url: string }) => req.url.startsWith("/api/v2/raw/transaction/"))).toHaveLength(0);
});

test("no-match, missing transaction and corrupted commitment remain distinct", async ({ page, request }) => {
  for (const [name, message] of [["valid-key-no-recognized-outputs", "No outputs recognized"], ["damaged-commitment", "commitment check"], ["damaged-ecdh", "native uint64 range"]]) {
    const input = find(name);
    await page.goto(`/tools/receive?tx=${input.hash}`);
    await page.getByLabel("Receiving Ryo address").fill(input.address);
    await page.getByRole("button", { name: "Validate address locally" }).click();
    await expect(page.getByLabel("Private view key", { exact: true })).toBeEnabled();
    await page.getByLabel("Private view key", { exact: true }).fill(input.view_key);
    await page.getByRole("button", { name: "Verify received outputs", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(message);
    if (name !== "valid-key-no-recognized-outputs") await expect(page.getByRole("region", { name: "Received output result" })).toHaveCount(0);
  }
  await page.getByLabel("Transaction hash", { exact: true }).fill("f".repeat(64));
  await page.getByLabel("Private view key", { exact: true }).fill(good.view_key);
  await page.getByRole("button", { name: "Verify received outputs", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Transaction not found");
  for (const [mode, message] of [["outage", "data is unavailable"], ["receive-wrong-network", "different network"], ["receive-wrong-blob", "do not match the requested hash"]]) {
    await request.get(`http://127.0.0.1:3101/__control?mode=${mode}`);
    await page.getByLabel("Transaction hash", { exact: true }).fill(good.hash);
    await page.getByLabel("Private view key", { exact: true }).fill(good.view_key);
    await page.getByRole("button", { name: "Verify received outputs", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(message);
    await expect(page.getByRole("region", { name: "Received output result" })).toHaveCount(0);
    await expect(page.getByLabel("Private view key", { exact: true })).toHaveValue("");
  }
});

test("cancel and worker deadline clear inputs and prevent stale results or server fallback", async ({ page, request }) => {
  await page.goto(`/tools/receive?tx=${good.hash}`);
  await page.route("**/crypto/ryo-receive.wasm", (route) => route.abort());
  await page.getByLabel("Receiving Ryo address").fill(good.address);
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByRole("status")).toContainText(/unavailable|could not run/);
  await page.unroute("**/crypto/ryo-receive.wasm");
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByLabel("Private view key", { exact: true })).toBeEnabled();
  await page.route("**/api/v2/raw/transaction/**", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue().catch(() => {}); });
  await page.getByLabel("Private view key", { exact: true }).fill(good.view_key);
  await page.getByRole("button", { name: "Verify received outputs", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Reading public transaction");
  await page.getByRole("button", { name: "Cancel and clear" }).click();
  await expect(page.getByLabel("Private view key", { exact: true })).toHaveValue("");
  await expect(page.getByRole("region", { name: "Received output result" })).toHaveCount(0);
  await page.unroute("**/api/v2/raw/transaction/**");
  await page.route("**/crypto/receive-worker.js", (route) => route.fulfill({ contentType: "text/javascript", body: "self.onmessage = () => {};" }));
  await page.getByLabel("Receiving Ryo address").fill(good.address);
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByRole("status")).toContainText("15-second limit", { timeout: 20_000 });
  await expect(page.getByLabel("Private view key", { exact: true })).toBeDisabled();
  const server = await (await request.get("http://127.0.0.1:3101/__control")).json();
  expect(JSON.stringify(server.observed)).not.toContain(good.view_key);
});

test("local tool has no submission fallback without JavaScript and is accessible on mobile", async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto("/tools/receive");
  await expect(staticPage.getByText("Local verification requires JavaScript", { exact: false })).toBeVisible();
  await expect(staticPage.getByLabel("Private view key", { exact: true })).toBeDisabled();
  expect(await staticPage.getByLabel("Private view key", { exact: true }).evaluate((input) => input.closest("form"))).toBeNull();
  await context.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/receive");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verify received outputs");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("leaving the tool and returning clears an unused view key and address validation", async ({ page }) => {
  await page.goto(`/tools/receive?tx=${good.hash}`);
  await page.getByLabel("Receiving Ryo address").fill(good.address);
  await page.getByRole("button", { name: "Validate address locally" }).click();
  await expect(page.getByLabel("Private view key", { exact: true })).toBeEnabled();
  await page.getByLabel("Private view key", { exact: true }).fill(good.view_key);
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inspection tools");
  await page.goBack();
  await expect(page.getByLabel("Private view key", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Private view key", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Receiving Ryo address")).toHaveValue("");
  await expect(page.getByRole("region", { name: "Received output result" })).toHaveCount(0);
});
