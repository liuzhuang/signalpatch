import { appendFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("health endpoint reports the deployed version", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});

test("home theme follows system preference and persists keyboard selection", async ({
  page,
}) => {
  const toggle = page.getByRole("button", { name: "切换亮色/深色模式" });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
      ),
    )
    .toBe("#07090d");

  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
      ),
    )
    .toBe("#f7f8fa");

  await toggle.focus();
  await toggle.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
      ),
    )
    .toBe("#07090d");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
      ),
    )
    .toBe("#f7f8fa");
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
