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
    page.getByRole("heading", { name: "Inside the chain." }),
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
    page.getByRole("heading", { name: "Built to be inspected." }),
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
