import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
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
