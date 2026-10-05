import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
});
test("live reader changes refresh blocks; unchanged tips, pause, outage and earlier pages stay stable", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto("/");
  const live = page.getByRole("button", { name: "Pause live updates" });
  await expect(live).toHaveAttribute("aria-pressed", "true");
  const metric = page.locator(".metric-card").first();
  await expect(metric).toContainText("9,007,199,254,741,023");
  // Confirm an unchanged tip causes only one network read, not a route refresh.
  const before = await (await request.get("http://127.0.0.1:3101/__control")).json();
  await page.clock.runFor(10_100);
  await expect.poll(async () =>
    (await (await request.get("http://127.0.0.1:3101/__control")).json()).reads,
  ).toBe(before.reads + 1);
  await page.getByLabel("Search the Ryo blockchain", { exact: true }).fill("12345");
  await page.evaluate(() => window.scrollTo(0, 350));
  const scroll = await page.evaluate(() => window.scrollY);
  await request.get("http://127.0.0.1:3101/__control?mode=advanced");
  await page.clock.runFor(10_100);
  await expect(metric).toContainText("9,007,199,254,741,024");
  await expect(page.getByRole("link", { name: "Block 9007199254741024", exact: true })).toBeVisible();
  await expect(page.getByLabel("Search the Ryo blockchain", { exact: true })).toHaveValue("12345");
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await expect(page.getByRole("status")).toContainText("Reader advanced to block");
  await live.click();
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.clock.runFor(30_100);
  expect((await (await request.get("http://127.0.0.1:3101/__control")).json()).reads).toBe(0);
  await expect(metric).toContainText("9,007,199,254,741,024");
  await page.getByRole("button", { name: "Resume live updates" }).click();
  await request.get("http://127.0.0.1:3101/__control?mode=outage");
  await page.clock.runFor(10_100);
  await expect(page.getByRole("status")).toContainText("Reader unavailable");
  await expect(metric).toContainText("9,007,199,254,741,024");
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.clock.runFor(10_100);
  await expect(metric).toContainText("9,007,199,254,741,023");
  await page.getByRole("link", { name: "Earlier blocks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause live updates" })).toHaveCount(0);
  const earlier = await (await request.get("http://127.0.0.1:3101/__control")).json();
  await page.clock.runFor(30_100);
  expect((await (await request.get("http://127.0.0.1:3101/__control")).json()).reads).toBe(earlier.reads);
});
test("server-rendered exact data, safe raw proxy, theme persistence, desktop accessibility", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origins = new Set<string>();
  page.on("request", (r) => origins.add(new URL(r.url()).origin));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ryo Blockchain Explorer" }),
  ).toBeVisible();
  await expect(
    page.getByText("18,446,744,073,709,551,615", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("9,007,199,254,741,023", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Observed block intervals/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Toggle color theme" })
    .filter({ visible: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const raw = await request.get("/api/v2/raw/block/0");
  expect(raw.status()).toBe(200);
  expect(await raw.text()).toContain("18446744073709551615");
  expect(raw.headers()["cache-control"]).toBe("no-store");
  expect(
    (await request.get("/api/v2/network?viewkey=synthetic-secret")).status(),
  ).toBe(400);
  expect((await request.post("/api/v2/blocks")).status()).toBe(405);
  expect([...origins]).toEqual(["http://127.0.0.1:3100"]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
});
test("mobile navigation, pagination, reorg recovery, developer guide, keyboard and no overflow", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Earlier blocks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Earlier blocks" }),
  ).toBeVisible();
  await expect(
    page.getByText("9,007,199,254,741,003", { exact: true }).first(),
  ).toBeVisible();
  await request.get("http://127.0.0.1:3101/__control?mode=reorg");
  await page.reload();
  await expect(
    page.getByText("The chain changed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Restart from latest blocks" }).click();
  await expect(
    page.getByRole("heading", { name: "Recent blocks" }),
  ).toBeVisible();
  await page.getByLabel("Open navigation").click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Developer API" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Developer API" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
test("outages and genesis render truthful empty states; invalid pagination never reaches the reader", async ({
  page,
  request,
}) => {
  await request.get("http://127.0.0.1:3101/__control?mode=outage");
  await page.goto("/");
  await expect(
    page.getByText("Chain reader unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await request.get("http://127.0.0.1:3101/__control?mode=genesis");
  await page.goto("/");
  await expect(page.getByText("Genesis · time not recorded")).toBeVisible();
  await expect(page.getByText("Beginning of the chain")).toBeVisible();
  await expect(page.getByText("More blocks, more perspective.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/?cursor=invalid");
  await expect(
    page.getByText("Invalid block page. Restart from the latest blocks."),
  ).toBeVisible();
});

test("block links open HTML details and transaction pages; public search resolves heights and both hash types", async ({
  page,
  request,
}) => {
  await request.get("http://127.0.0.1:3101/__control?mode=genesis");
  await page.goto("/");
  await page.getByRole("link", { name: "Block 0", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Block 0", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/blocks\//);
  await expect(
    page.getByRole("heading", { name: "Transactions in this block" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const coinbase =
    "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88";
  const block =
    "6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac";
  await page.locator(`a[href='/transactions/${coinbase}']`).first().click();
  await expect(
    page.getByRole("heading", { name: "Transaction details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("8,800,000.000000000 RYO", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Block 0", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const [query, path] of [
    ["0", "/blocks/0"],
    [block.toUpperCase(), `/blocks/${block}`],
    [coinbase, `/transactions/${coinbase}`],
  ]) {
    await page
      .getByLabel("Search the Ryo blockchain", { exact: true })
      .fill(query);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Block 0", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("detail pages preserve hidden amounts, mempool state, exact fees and output pagination", async ({
  page,
  request,
}) => {
  const tx = "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88";
  await request.get("http://127.0.0.1:3101/__control?mode=ringct");
  await page.goto(`/transactions/${tx}`);
  await expect(
    page.getByText("9,007,199.254740993 RYO", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Hidden by RingCT", { exact: true })).toHaveCount(
    50,
  );
  await expect(
    page.getByText("This view does not identify the real spent output.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Next outputs" }).click();
  await expect(page.getByText("Hidden by RingCT", { exact: true })).toHaveCount(
    1,
  );
  await request.get("http://127.0.0.1:3101/__control?mode=mempool");
  await page.goto(`/transactions/${tx}`);
  await expect(page.getByText("In mempool", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not included in a block", { exact: true }),
  ).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("search validates before lookup; missing data and partial outages have distinct truthful states", async ({
  page,
  request,
}) => {
  await request.get("http://127.0.0.1:3101/__control?mode=genesis");
  for (const query of [
    "q=18446744073709551616",
    "q=0&q=1",
    "q=0&viewkey=synthetic-secret",
    "q=https%3A%2F%2Fexample.com",
  ]) {
    await page.goto(`/search?${query}`);
    await expect(
      page.getByRole("heading", { name: "Invalid request" }),
    ).toBeVisible();
  }
  expect(
    (await (await request.get("http://127.0.0.1:3101/__control")).json()).reads,
  ).toBe(0);
  const missing = "c".repeat(64);
  await page.goto(`/search?q=${missing}`);
  await expect(
    page.getByRole("heading", { name: "No matching block or transaction" }),
  ).toBeVisible();
  const response = await page.goto("/blocks/99");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Block not found" }),
  ).toBeVisible();
  const txResponse = await page.goto(`/transactions/${missing}`);
  expect(txResponse?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Transaction not found" }),
  ).toBeVisible();
  await request.get("http://127.0.0.1:3101/__control?mode=partial-outage");
  await page.goto(`/search?q=${missing}`);
  await expect(
    page.getByRole("heading", { name: "Chain reader unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No matching block or transaction" }),
  ).toHaveCount(0);
});

test("JSON links preserve the explorer layout, format exactly and safely, with original and download views", async ({
  page,
  request,
}) => {
  const errors: string[] = [],
    origins = new Set<string>();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => origins.add(new URL(r.url()).origin));
  await request.get("http://127.0.0.1:3101/__control?mode=genesis");
  await page.goto("/blocks/0");
  await page.getByRole("link", { name: "Block JSON", exact: true }).click();
  await expect(page).toHaveURL(/\/json\/blocks\//);
  await expect(
    page.getByRole("heading", { name: "Block JSON", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ryo Explorer home" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Search the Ryo blockchain", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to block" })).toBeVisible();
  const code = page.getByRole("region", { name: "JSON response", exact: true });
  expect(await code.textContent()).toContain('\n  "data": {');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Back to block" }).click();
  await page.locator("a[href^='/transactions/']").first().click();
  await page
    .getByRole("link", { name: "Transaction JSON", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Transaction JSON", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to transaction" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to transaction" }).click();
  await page.getByRole("link", { name: "Raw JSON", exact: true }).click();
  await expect(page).toHaveURL(/\/json\/raw\/transaction\//);
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.goto("/json/raw/block/0");
  const original = await (await request.get("/api/v2/raw/block/0")).text();
  expect(await code.textContent()).toContain('"exact": 18446744073709551615');
  expect(await code.textContent()).toContain("<img src=");
  await expect(page.locator("img[src='/__unexpected']")).toHaveCount(0);
  await page.getByRole("button", { name: "Original", exact: true }).click();
  expect(await code.textContent()).toBe(original);
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JSON" }).click();
  expect((await download).suggestedFilename()).toBe("ryo-response.json");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await request.get("http://127.0.0.1:3101/__control?mode=genesis");
  await page.goto("/json/network?viewkey=synthetic-secret");
  await expect(
    page.getByRole("heading", { name: "Invalid request" }),
  ).toBeVisible();
  await page.goto("/json/https://example.com");
  await expect(
    page.getByRole("heading", { name: "Invalid request" }),
  ).toBeVisible();
  expect(
    (await (await request.get("http://127.0.0.1:3101/__control")).json()).reads,
  ).toBe(0);
  expect([...origins]).toEqual(["http://127.0.0.1:3100"]);
  expect(errors).toEqual([]);
});
