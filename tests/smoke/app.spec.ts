import { appendFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("homepage uses the system theme until its keyboard-operable control is used", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const html = page.locator("html");
  const background = () =>
    html.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--background").trim(),
    );
  const darkToggle = page.getByRole("button", {
    name: "Switch to dark theme",
  });

  await expect(html).not.toHaveAttribute("data-theme");
  await expect.poll(background).toBe("#f7f8fa");
  await expect(darkToggle).toHaveAttribute("aria-pressed", "false");
  await darkToggle.press("Space");

  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect.poll(background).toBe("#07090d");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Switch to light theme" })
    .press("Enter");

  await expect(html).toHaveAttribute("data-theme", "light");
  await expect.poll(background).toBe("#f7f8fa");
});

test("homepage uses the dark system theme by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--background").trim(),
        ),
    )
    .toBe("#07090d");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("health endpoint reports the deployed version", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
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
