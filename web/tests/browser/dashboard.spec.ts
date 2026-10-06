import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
});
test("interval chart has exact block/seconds axes, historical period controls, keyboard inspection and coverage states", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const chart = page.locator(".interval-panel");
  await expect(
    chart.getByRole("img", { name: /Observed block intervals/ }),
  ).toBeVisible();
  await expect(chart.getByText("Block number", { exact: true })).toBeVisible();
  await expect(
    chart.getByText("Seconds since previous block", { exact: true }),
  ).toBeVisible();
  await expect(
    chart.locator(".chart-tick").filter({ hasText: "9,007,199,254,741,023" }),
  ).toBeVisible();
  await expect(chart.locator(".chart-bars")).toHaveAttribute(
    "data-bar-count",
    "12",
  );
  await expect(chart.locator("[data-block-height]")).toHaveCount(12);
  await expect(chart.locator(".chart-target, .chart-line")).toHaveCount(0);
  await expect
    .poll(() =>
      chart
        .locator(".interval-plot")
        .evaluate((element) =>
          Math.abs(
            element.scrollWidth - element.clientWidth - element.scrollLeft,
          ),
        ),
    )
    .toBeLessThan(2);
  const heights = await chart
    .locator("[data-block-height]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-block-height")!),
    );
  expect(
    heights.every(
      (height, i) => i === 0 || BigInt(height) > BigInt(heights[i - 1]),
    ),
  ).toBe(true);
  for (const [label, count] of [
    ["Last hour", 12],
    ["Last 24 hours", 80],
    ["Last 7 days", 120],
    ["Last 30 days", 180],
  ] as const) {
    await chart.getByRole("button", { name: label, exact: true }).click();
    await expect(
      chart.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(chart.getByLabel("Inspect a block interval")).toHaveAttribute(
      "aria-valuemax",
      String(count - 1),
    );
  }
  const slider = chart.getByLabel("Inspect a block interval");
  await slider.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(
    chart.getByText("-30 s since block", { exact: false }),
  ).toBeVisible();
  await expect(
    chart.getByText("This block’s timestamp precedes its predecessor."),
  ).toBeVisible();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "2");
  await expect(chart.locator(".chart-inspector a")).toHaveAttribute(
    "href",
    /^\/blocks\/[0-9]+$/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await chart
    .getByRole("button", { name: "Back to live", exact: true })
    .click();
  await expect
    .poll(() =>
      chart
        .locator(".interval-plot")
        .evaluate((element) =>
          Math.abs(
            element.scrollWidth - element.clientWidth - element.scrollLeft,
          ),
        ),
    )
    .toBeLessThan(2);
  const axis = await chart.locator(".chart-y-axis").boundingBox();
  const viewport = await chart.locator(".interval-plot").boundingBox();
  expect(axis!.x).toBeCloseTo(viewport!.x, 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await request.get("http://127.0.0.1:3101/__control?mode=interval-limited");
  await page.goto("/");
  await expect(
    chart.getByText(/Partial history for this period/),
  ).toBeVisible();
});
test("the fixed plot shows every native interval with the exact count for 4, 10 and 20 blocks", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    let dimensions: { width: number; height: number } | null = null;
    for (const [mode, count] of [
      ["interval-four", 4],
      ["interval-ten", 10],
      ["interval-twenty", 20],
    ] as const) {
      await request.get(`http://127.0.0.1:3101/__control?mode=${mode}`);
      await page.goto("/");
      const chart = page.locator(".interval-panel[aria-labelledby]");
      const plot = chart.locator(".interval-plot");
      await expect(chart.locator(".chart-block-count b")).toHaveText(
        `${count} blocks shown`,
      );
      await expect(chart.locator("[data-block-height]")).toHaveCount(count);
      await expect
        .poll(() => plot.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThan(2);
      const measure = () =>
        chart.evaluate((el) => {
          const viewport = el
            .querySelector(".interval-plot")!
            .getBoundingClientRect();
          const axis = el
            .querySelector(".chart-y-axis")!
            .getBoundingClientRect();
          const svg = el.querySelector<SVGSVGElement>("svg[role=img]")!;
          const visible = [
            ...el.querySelectorAll("[data-block-height]"),
          ].filter((label) => {
            const center = new DOMPoint(
              Number(label.getAttribute("x")),
              120,
            ).matrixTransform(svg.getScreenCTM()!);
            return center.x >= axis.right && center.x <= viewport.right;
          }).length;
          const path = el.querySelector(".chart-bars")!.getAttribute("d")!;
          return {
            width: viewport.width,
            height: viewport.height,
            visible,
            bars: (path.match(/M/g) ?? []).length,
          };
        });
      await expect.poll(async () => (await measure()).visible).toBe(count);
      const measured = await measure();
      expect(measured.visible).toBe(count);
      expect(measured.bars).toBe(count);
      if (dimensions)
        expect({ width: measured.width, height: measured.height }).toEqual(
          dimensions,
        );
      dimensions = { width: measured.width, height: measured.height };
    }
  }
});
test("hover inspection holds its native window through sync and returns to the latest block without a visible slider", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto("/");
  const chart = page.locator(".interval-panel");
  const plot = chart.getByLabel("Inspect a block interval");
  await expect(plot).toHaveAttribute("aria-valuemax", "11");
  await expect(chart.locator("input[type=range]")).toHaveCount(0);
  expect(
    await plot.evaluate((element) => getComputedStyle(element).scrollbarWidth),
  ).toBe("none");
  await plot.scrollIntoViewIfNeeded();
  await page.clock.runFor(500);
  const area = (await plot.boundingBox())!;
  await page.mouse.move(area.x + 180, area.y + 120);
  const resume = chart.getByRole("button", {
    name: "Back to live",
    exact: true,
  });
  await expect(resume).toBeVisible();
  const heading = (await chart.locator(".chart-heading").boundingBox())!;
  const button = (await resume.boundingBox())!;
  expect(button.x).toBeGreaterThan(heading.x + heading.width / 2);
  await page.mouse.move(5, 5);
  const selected = await plot.getAttribute("aria-valuetext");
  const path = await chart.locator(".chart-bars").getAttribute("d");
  const position = await plot.evaluate((element) => element.scrollLeft);
  await request.get("http://127.0.0.1:3101/__control?mode=advanced");
  await page.clock.runFor(10_100);
  await expect(page.locator(".metric-card").first()).toContainText(
    "9,007,199,254,741,024",
  );
  await expect(plot).toHaveAttribute("aria-valuetext", selected!);
  await expect(chart.locator(".chart-period-end").first()).toContainText(
    "9,007,199,254,741,023",
  );
  await expect(chart.locator(".chart-bars")).toHaveAttribute("d", path!);
  expect(await plot.evaluate((element) => element.scrollLeft)).toBe(position);
  await resume.click();
  await page.clock.runFor(1000);
  await expect(resume).toHaveCount(0);
  await expect(chart.locator("[data-block-height]").last()).toHaveAttribute(
    "data-block-height",
    "9007199254741024",
  );
  await expect(plot).toHaveAttribute(
    "aria-valuetext",
    /^Block 9007199254741024:/,
  );
  await expect
    .poll(() =>
      plot.evaluate((element) =>
        Math.abs(
          element.scrollWidth - element.clientWidth - element.scrollLeft,
        ),
      ),
    )
    .toBeLessThan(2);
  await plot.focus();
  await page.keyboard.press("Home");
  await expect(resume).toBeVisible();
  await chart
    .getByRole("button", { name: "Last 24 hours", exact: true })
    .click();
  await expect(resume).toHaveCount(0);
  await expect(plot).toHaveAttribute("aria-valuemax", "79");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("scroll docks one search in the sticky menu, preserving draft and focus on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByLabel("Search the Ryo blockchain", { exact: true });
  const header = page.locator(".site-header");
  await expect(header.getByRole("search")).toHaveCount(0);
  await expect(page.locator("main").getByRole("search")).toHaveCount(1);
  await search.fill("12345");
  await search.evaluate((element: HTMLInputElement) =>
    element.setSelectionRange(1, 3),
  );
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(header.getByRole("search")).toHaveCount(1);
  await expect(page.getByRole("search")).toHaveCount(1);
  await expect(search).toHaveValue("12345");
  await expect(search).toBeFocused();
  expect(
    await search.evaluate((element: HTMLInputElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([1, 3]);
  expect((await header.boundingBox())!.y).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(500);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header.getByRole("search")).toHaveCount(0);
  await expect(page.locator("main").getByRole("search")).toHaveCount(1);
  await expect(search).toHaveValue("12345");
  await expect(search).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(header.getByRole("search")).toHaveCount(1);
  expect((await header.boundingBox())!.y).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const field = (await search.boundingBox())!;
  expect(field.width).toBeGreaterThan(90);
  expect(field.x + field.width).toBeLessThan(390);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Open navigation").click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.getByLabel("Open navigation").click();
  await search.fill("0");
  await search.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Block 0", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("search")).toHaveCount(1);
});
test("reference metrics use native semantics, node sync is explicit and pool-only changes refresh the dashboard", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto("/");
  const node = page.getByRole("region", {
    name: "Node connection",
    exact: true,
  });
  await expect(node).toContainText("Synchronizing");
  await expect(node).toContainText("264.695 kH/s");
  await expect(page.getByLabel("Node synchronization progress")).toBeVisible();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Issued supply" }),
  ).toContainText("8,800,000.000000000 RYO");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Latest coinbase payout" }),
  ).toContainText("Includes transaction fees");
  await expect(page.locator(".chain-context")).toContainText("0 pending");
  await expect(page.locator(".chain-context")).toContainText("Block protocol");
  expect(await page.content()).not.toContain(
    "internal-node-address-must-not-be-exposed",
  );
  await request.get("http://127.0.0.1:3101/__control?mode=pool-changed");
  await page.clock.runFor(10_100);
  await expect(page.locator(".chain-context")).toContainText("1 pending");
  await expect(page.getByRole("status")).toContainText(
    "Local transaction pool changed",
  );
  await request.get("http://127.0.0.1:3101/__control?mode=node-outage");
  await page.reload();
  await expect(node).toContainText("delayed; retrying on refresh");
  await expect(node).toContainText("Synchronizing");
  await request.get("http://127.0.0.1:3101/__control?mode=node-wrong-network");
  await page.reload();
  await expect(node).toContainText("Node status unavailable");
  await expect(
    page.getByRole("table", { name: "Recent blocks" }),
  ).toBeVisible();
});
test("full-width desktop block and transaction tables stack on mobile and preserve native fee and failure semantics", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto("/");
  const blocks = page.getByRole("table", { name: "Recent blocks" });
  const transactions = page.getByRole("table", { name: "Recent transactions" });
  await expect(transactions.locator("tbody tr")).toHaveCount(15);
  await expect(
    transactions.getByText("9,007,199.254740993", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    transactions.getByText("Coinbase", { exact: true }).first(),
  ).toBeVisible();
  const panels = page.locator(".dashboard-tables > section");
  const left = (await panels.nth(0).boundingBox())!;
  const right = (await panels.nth(1).boundingBox())!;
  expect(Math.abs(left.y - right.y)).toBeLessThan(1);
  expect(right.x).toBeGreaterThan(left.x + left.width);
  expect((await page.locator("main").boundingBox())!.width).toBe(1920);
  await expect(
    transactions.locator("a[href^='/transactions/']").first(),
  ).toHaveAttribute("href", /^\/transactions\/[0-9a-f]{64}$/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLeft = (await panels.nth(0).boundingBox())!;
  const mobileRight = (await panels.nth(1).boundingBox())!;
  expect(mobileRight.y).toBeGreaterThan(mobileLeft.y + mobileLeft.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const mode of ["tx-outage", "tx-mismatch"]) {
    await request.get(`http://127.0.0.1:3101/__control?mode=${mode}`);
    await page.goto("/");
    await expect(
      page.getByText("Transaction list unavailable", { exact: true }),
    ).toBeVisible();
    await expect(blocks.locator("tbody tr")).toHaveCount(20);
    await expect(transactions).toHaveCount(0);
  }
  await request.get("http://127.0.0.1:3101/__control?mode=genesis");
  await page.goto("/");
  await expect(transactions.locator("tbody tr")).toHaveCount(1);
  await transactions.locator("a[href^='/transactions/']").click();
  await expect(
    page.getByRole("heading", { name: "Transaction details", exact: true }),
  ).toBeVisible();
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
  // Begin after client hydration so the poll timer is installed in the test clock.
  await live.click();
  await page.getByRole("button", { name: "Resume live updates" }).click();
  // Confirm an unchanged tip causes only one network read, not a route refresh.
  const before = await (
    await request.get("http://127.0.0.1:3101/__control")
  ).json();
  await page.clock.runFor(10_100);
  await expect
    .poll(
      async () =>
        (await (await request.get("http://127.0.0.1:3101/__control")).json())
          .reads,
    )
    .toBe(before.reads + 1);
  await expect(page.locator(".live-blocks")).toContainText("Last checked");
  // An hour refresh follows the new rightmost bar even after inspecting older bars.
  await page.locator(".interval-plot").evaluate((element) => {
    element.scrollLeft = 0;
  });
  await request.get("http://127.0.0.1:3101/__control?mode=advanced");
  await page.clock.runFor(10_100);
  await expect(metric).toContainText("9,007,199,254,741,024");
  await expect(page.locator("[data-block-height]").last()).toHaveAttribute(
    "data-block-height",
    "9007199254741024",
  );
  await page.clock.runFor(1000);
  await expect
    .poll(() =>
      page
        .locator(".interval-plot")
        .evaluate((element) =>
          Math.abs(
            element.scrollWidth - element.clientWidth - element.scrollLeft,
          ),
        ),
    )
    .toBeLessThan(2);
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.clock.runFor(10_100);
  await expect(metric).toContainText("9,007,199,254,741,023");
  await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await expect(page.getByLabel("Inspect a block interval")).toHaveAttribute(
    "aria-valuemax",
    "119",
  );
  await page
    .getByLabel("Search the Ryo blockchain", { exact: true })
    .fill("12345");
  await page.evaluate(() => window.scrollTo(0, 350));
  const scroll = await page.evaluate(() => window.scrollY);
  await request.get("http://127.0.0.1:3101/__control?mode=advanced");
  await page.clock.runFor(10_100);
  await expect(metric).toContainText("9,007,199,254,741,024");
  await expect(
    page.getByRole("button", { name: "Last 7 days", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".chart-period-end").first()).toContainText(
    "9,007,199,254,741,024",
  );
  await expect(
    page
      .getByRole("table", { name: "Recent transactions" })
      .locator("tbody tr")
      .first(),
  ).toContainText("9,007,199,254,741,024");
  await expect(
    page.getByRole("link", { name: "Block 9007199254741024", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Search the Ryo blockchain", { exact: true }),
  ).toHaveValue("12345");
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await expect(page.getByRole("status")).toContainText(
    "Reader advanced to block",
  );
  await live.click();
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.clock.runFor(30_100);
  expect(
    (await (await request.get("http://127.0.0.1:3101/__control")).json()).reads,
  ).toBe(0);
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
  await expect(
    page.getByRole("button", { name: "Pause live updates" }),
  ).toHaveCount(0);
  const earlier = await (
    await request.get("http://127.0.0.1:3101/__control")
  ).json();
  await page.clock.runFor(30_100);
  expect(
    (await (await request.get("http://127.0.0.1:3101/__control")).json()).reads,
  ).toBe(earlier.reads);
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
  await expect(
    page
      .getByRole("table", { name: "Recent blocks" })
      .getByText("Genesis · time not recorded"),
  ).toBeVisible();
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

test("mempool pages cover all entries, detect membership changes and recover from empty and unavailable states", async ({
  page,
  request,
  browser,
}) => {
  await page.clock.install();
  await page.goto("/mempool");
  const table = page.getByRole("table", {
    name: "Pending transactions",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(50);
  const received = table
    .getByRole("button", { name: /About this node's receive time/ })
    .first();
  await expect(received).toContainText("2026-10-06 12:50:00");
  await received.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "When this node recorded the transaction",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "Other nodes may record a different time",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await received.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  await expect(table).toContainText("Uniform");
  await expect(table.locator("tbody tr").first()).toContainText("25");
  await expect(page.locator(".section-note")).toContainText("1–50 of 53");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Next transactions" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(page.locator(".section-note")).toContainText("51–53 of 53");
  await page.getByRole("button", { name: "Pause pool updates" }).click();
  await request.get("http://127.0.0.1:3101/__control?mode=pool-mutated");
  await page.clock.runFor(20_100);
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Resume pool updates" }).click();
  await page.clock.runFor(10_100);
  await expect(page).toHaveURL(/\/mempool$/);
  await expect(page.locator(".section-note")).toContainText("1–50 of 54");
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.getByRole("link", { name: "Next transactions" }).click();
  await expect(
    page.getByRole("heading", { name: "Mempool changed", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Restart mempool" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(50);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const touchContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const touchPage = await touchContext.newPage();
    await touchPage.goto("/mempool");
    await touchPage
      .getByRole("button", { name: /About this node's receive time/ })
      .first()
      .tap();
    await expect(touchPage.getByRole("tooltip")).toContainText(
      "Other nodes may record a different time",
    );
    expect(
      (await new AxeBuilder({ page: touchPage }).analyze()).violations,
    ).toEqual([]);
  } finally {
    await touchContext.close();
  }
  await request.get("http://127.0.0.1:3101/__control?mode=pool-time-unknown");
  await page.reload();
  await expect(table.getByLabel("Local receive time unavailable")).toHaveCount(
    50,
  );
  await request.get("http://127.0.0.1:3101/__control?mode=pool-empty");
  await page.reload();
  await expect(
    page.getByText("No relayable transactions in this node's pool.", {
      exact: true,
    }),
  ).toBeVisible();
  await request.get("http://127.0.0.1:3101/__control?mode=outage");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Chain reader unavailable",
      exact: true,
    }),
  ).toBeVisible();
});
test("public tools submit native identifiers, explain negative results and reject secret parameters before lookup", async ({
  page,
  request,
}) => {
  await page.goto("/tools");
  await page.getByRole("link", { name: /Key image status/ }).click();
  await page
    .getByLabel("Public key image", { exact: true })
    .fill("a".repeat(64));
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Verification result" }),
  ).toContainText("Key image not found in confirmed chain");
  await request.get("http://127.0.0.1:3101/__control?mode=image-spent");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Verification result" }),
  ).toContainText("Key image recorded as spent");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Result JSON", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inspection result JSON", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to tools", exact: true }).click();
  await page.getByRole("link", { name: /Output key check/ }).click();
  await page
    .getByLabel("Transaction hash", { exact: true })
    .fill("b".repeat(64));
  await page
    .getByLabel("Public output key", { exact: true })
    .fill("a".repeat(64));
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Verification result" }),
  ).toContainText("Output key found in transaction");
  await request.get("http://127.0.0.1:3101/__control?mode=output-absent");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Verification result" }),
  ).toContainText("Output key not found in transaction");
  await page.getByRole("link", { name: /Address inspector/ }).click();
  await page
    .getByLabel("Public Ryo address", { exact: true })
    .fill("1".repeat(95));
  await page
    .getByRole("button", { name: "Inspect address", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Verification result" }),
  ).toContainText("Address failed native validation");
  await request.get("http://127.0.0.1:3101/__control?mode=address-valid");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Verification result" }),
  ).toContainText("Valid Ryo address");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await request.get("http://127.0.0.1:3101/__control?mode=normal");
  await page.goto(
    "/tools?tool=key-image&value=" + "a".repeat(64) + "&viewkey=secret",
  );
  await expect(
    page.getByRole("heading", { name: "Invalid request", exact: true }),
  ).toBeVisible();
  expect(
    (await (await request.get("http://127.0.0.1:3101/__control")).json()).reads,
  ).toBe(0);
});
