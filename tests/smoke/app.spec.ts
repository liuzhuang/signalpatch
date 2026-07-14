import { appendFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("health endpoint reports the deployed version", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});

test("theme follows the system preference and can be switched", async ({
  browser,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto("/");

    const expectedBackground =
      colorScheme === "light" ? "rgb(246, 247, 249)" : "rgb(7, 9, 13)";
    await expect(
      page.getByRole("button", {
        name: `${colorScheme === "light" ? "亮色" : "深色"}模式`,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      )
      .toBe(expectedBackground);

    await page.getByRole("button", { name: "亮色模式" }).click();
    await expect(
      page.getByRole("button", { name: "亮色模式" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      )
      .toBe("rgb(246, 247, 249)");

    await page.getByRole("button", { name: "深色模式" }).click();
    await expect(
      page.getByRole("button", { name: "深色模式" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      )
      .toBe("rgb(7, 9, 13)");

    await expect(page.getByLabel("问题或建议")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "获取 Tracking ID" }),
    ).toBeEnabled();
    await expect(page.getByLabel("Tracking ID")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "查看处理状态" }),
    ).toBeEnabled();
    await context.close();
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
