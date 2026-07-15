import { appendFile } from "node:fs/promises";

import { expect, type Locator, test } from "@playwright/test";

async function expectHorizontallyCentered(
  locator: Locator,
  container: Locator,
  tolerance = 2,
) {
  const [box, containerBox] = await Promise.all([
    locator.boundingBox(),
    container.boundingBox(),
  ]);
  expect(box).not.toBeNull();
  expect(containerBox).not.toBeNull();
  expect(
    Math.abs(
      box!.x + box!.width / 2 - (containerBox!.x + containerBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(tolerance);
}

async function expectFullWidth(locator: Locator, container: Locator) {
  const [box, containerBox, padding] = await Promise.all([
    locator.boundingBox(),
    container.boundingBox(),
    container.evaluate((element) => {
      const style = getComputedStyle(element);
      return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    }),
  ]);
  expect(box).not.toBeNull();
  expect(containerBox).not.toBeNull();
  expect(box!.width).toBeCloseTo(containerBox!.width - padding, 0);
}

test("health endpoint reports the deployed version", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});

test("homepage follows the system theme and supports an accessible override", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(246, 247, 248)",
  );
  expect((await page.locator(".hero-copy").textContent())?.trim()).not.toBe("");

  const toggle = page.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(7, 9, 13)",
  );
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(246, 247, 248)",
  );

  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(7, 9, 13)",
  );
  await expect(page.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("homepage links to the mock About page", async ({ page }) => {
  await page.goto("/");

  const aboutLink = page.getByRole("link", { name: "关于" });
  await expect(aboutLink).toHaveAttribute("href", "/about");
  await aboutLink.click();

  await expect(page).toHaveURL(/\/about$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "关于我们" }),
  ).toBeVisible();
  await expect(page.getByText("SignalPatch", { exact: true })).toBeVisible();
  await expect(page.getByText("Mock 数据", { exact: true })).toBeVisible();
});

test("About page links to the homepage and public Issues", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/about");

    await expect(
      page.getByRole("heading", { level: 1, name: "关于我们" }),
    ).toBeVisible();
    await expect(page.getByText("SignalPatch", { exact: true })).toBeVisible();
    await expect(page.getByText("Mock 数据", { exact: true })).toBeVisible();

    const homeLink = page.getByRole("link", { name: "返回首页" });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");
    const issuesLink = page.getByRole("link", { name: "查看公开 Issue" });
    await expect(issuesLink).toBeVisible();
    await expect(issuesLink).toHaveAttribute(
      "href",
      "https://github.com/liuzhuang/signalpatch/issues",
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }

  const homeLink = page.getByRole("link", { name: "返回首页" });
  await homeLink.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "SignalPatch" }),
  ).toBeVisible();
});

test("homepage content is centered on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  const hero = page.locator(".hero");
  const heroTop = page.locator(".hero-top");
  const heroCopy = page.locator(".hero-copy");
  const flow = page.getByLabel("自动化阶段");
  await expect(heroTop).toHaveCSS("justify-content", "center");
  await expect(page.locator("h1")).toHaveCSS("text-align", "center");
  await expect(heroCopy).toHaveCSS("text-align", "center");
  await expect(flow).toHaveCSS("justify-content", "center");
  await expectHorizontallyCentered(heroCopy, hero);

  const workspace = page.locator(".workspace");
  await expect(workspace).toHaveCSS(
    "grid-template-columns",
    /^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/,
  );
  for (const panel of await page.locator(".panel").all()) {
    await expect(panel.locator(".panel-heading")).toHaveCSS(
      "justify-content",
      "center",
    );
    await expectHorizontallyCentered(panel.locator("button"), panel);
    const control = panel.locator("input, textarea");
    await expect(control).toHaveCSS("text-align", "left");
    await expectFullWidth(control, panel);
  }
  await expect(page.locator("input, textarea")).toHaveCount(2);

  const footer = page.locator("footer");
  await expect(footer).toHaveCSS("justify-content", "center");
  await expect(footer).toHaveCSS("text-align", "center");
  await expect(footer.locator("a")).toHaveCount(3);
  for (const child of await footer.locator(":scope > *").all()) {
    const box = await child.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  }
});

test("Feedback submission guidance is visible on desktop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const guidance = page
      .locator(".panel-heading")
      .filter({ has: page.getByRole("heading", { name: "提交 Feedback" }) })
      .locator("h2 + p");
    await expect(guidance).toHaveText(
      "无需登录，提交后会获得 Tracking ID，可随时查询处理状态。",
    );
    await expect(guidance).toBeVisible();

    if (viewport.width === 390) {
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }
});

test("Feedback character count updates, enforces the limit, and resets after submission", async ({
  page,
}) => {
  await page.route("**/api/feedback", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        trackingId: "00000000-0000-4000-8000-000000000041",
        repairStatus: "RECEIVED",
      },
      status: 201,
    });
  });

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const textarea = page.getByLabel("问题或建议");
    const count = page.getByLabel("Feedback 字数");
    await expect(count).toHaveText("0 / 2000");
    await expect(count).toBeVisible();

    await textarea.fill("123456789012");
    await expect(count).toHaveText("12 / 2000");

    await textarea.fill("a".repeat(2001));
    await expect(textarea).toHaveValue("a".repeat(2000));
    await expect(count).toHaveText("2000 / 2000");

    const [textareaBox, countBox] = await Promise.all([
      textarea.boundingBox(),
      count.boundingBox(),
    ]);
    expect(textareaBox).not.toBeNull();
    expect(countBox).not.toBeNull();
    expect(countBox!.y).toBeGreaterThanOrEqual(
      textareaBox!.y + textareaBox!.height,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "获取 Tracking ID" }).click();
    await expect(count).toHaveText("0 / 2000");
  }
});

test("homepage content remains centered without overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".workspace")).toHaveCSS(
    "grid-template-columns",
    /^\d+(?:\.\d+)?px$/,
  );
  await expect(page.getByLabel("自动化阶段")).toHaveCSS(
    "justify-content",
    "center",
  );
  await expect(page.locator("footer")).toHaveCSS("align-items", "center");
  await expectHorizontallyCentered(
    page.locator(".hero-copy"),
    page.locator(".hero"),
  );
  for (const panel of await page.locator(".panel").all()) {
    await expectHorizontallyCentered(panel.locator("button"), panel);
    await expect(panel.locator("input, textarea")).toHaveCSS(
      "text-align",
      "left",
    );
    await expect(panel.locator("input, textarea")).toBeVisible();
  }
  await expect(page.locator("input, textarea")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "关于" })).toBeVisible();
  await expect(page.getByRole("link", { name: "相册" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看公开仓库" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("homepage links to a responsive gallery with 20 mock images", async ({
  page,
}) => {
  await page.goto("/");

  const galleryLink = page.getByRole("link", { name: "相册" });
  await expect(galleryLink).toHaveAttribute("href", "/gallery");
  await galleryLink.click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "相册" }),
  ).toBeVisible();

  const grid = page.getByLabel("相册网格");
  const images = grid.locator("img");
  await expect(images).toHaveCount(20);
  for (const image of await images.all()) {
    await expect(image).toHaveAttribute("alt", /.+/);
    await expect(image).toBeVisible();
  }

  for (const [viewport, columnCount] of [
    [{ width: 1280, height: 720 }, 4],
    [{ width: 390, height: 844 }, 2],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/gallery");
    await expect(grid).toHaveCSS("display", "grid");
    expect(
      (await grid.evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      )) >= columnCount,
    ).toBe(true);
    if (viewport.width === 390) {
      await expect(grid).toHaveCSS(
        "grid-template-columns",
        /^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/,
      );
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test("anonymous Feedback returns the same status for exact and padded Tracking IDs", async ({
  request,
}) => {
  const submission = await request.post("/api/feedback", {
    data: {
      message: `Synthetic smoke Feedback ${Date.now()}`,
      context: {
        feature: "smoke-test",
        route: "/api/feedback",
        occurredAt: new Date().toISOString(),
      },
    },
  });
  expect(submission.status()).toBe(201);
  const body = (await submission.json()) as {
    trackingId: string;
    repairStatus: string;
  };
  expect(body.trackingId).toMatch(/^[0-9a-f-]{36}$/);
  expect(body.repairStatus).toBe("RECEIVED");

  if (process.env.SMOKE_TRACKING_IDS_FILE) {
    await appendFile(
      process.env.SMOKE_TRACKING_IDS_FILE,
      `${body.trackingId}\n`,
    );
  }

  const status = await request.get(
    `/api/status/${encodeURIComponent(body.trackingId)}`,
  );
  expect(status.ok()).toBe(true);
  const exactStatus = await status.json();
  expect(exactStatus).toMatchObject({
    trackingId: body.trackingId,
    repairStatus: "RECEIVED",
  });

  const paddedStatus = await request.get(
    `/api/status/${encodeURIComponent(` \t${body.trackingId}\n`)}`,
  );
  expect(paddedStatus.ok()).toBe(true);
  await expect(paddedStatus.json()).resolves.toEqual(exactStatus);
});

test("unknown Tracking ID remains not found", async ({ request }) => {
  const response = await request.get(
    "/api/status/00000000-0000-4000-8000-000000000000",
  );
  expect(response.status()).toBe(404);
});
