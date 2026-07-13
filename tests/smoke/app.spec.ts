import { appendFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("health endpoint reports the deployed version", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});

test("anonymous Feedback returns a Tracking ID and exact status", async ({
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
  await expect(status.json()).resolves.toMatchObject({
    trackingId: body.trackingId,
    repairStatus: "RECEIVED",
  });
});

test("unknown Tracking ID remains not found", async ({ request }) => {
  const response = await request.get(
    "/api/status/00000000-0000-4000-8000-000000000000",
  );
  expect(response.status()).toBe(404);
});
