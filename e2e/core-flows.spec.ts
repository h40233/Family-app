import { expect, test } from "@playwright/test";

test("renders core MVP pages from a real browser", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Family OS/i })).toBeVisible();
  await expect(page.locator("main h1")).toBeVisible();

  for (const path of [
    "/money/personal",
    "/money/shared-funds",
    "/tasks",
    "/points",
    "/wishes",
    "/reports",
    "/notifications",
    "/billing"
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("upgrades plan and downloads Excel-compatible report", async ({ page }) => {
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: "Plan and Limits" })).toBeVisible();

  const upgrade = page.getByRole("button", { name: "Upgrade" });
  if (await upgrade.isEnabled()) {
    await upgrade.click();
    await expect(page.getByText("Plan upgraded to paid")).toBeVisible();
  }

  await expect(page.getByText("Enabled").first()).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Household Reports" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("family-os-report.xls");
});

test("notification center exposes Web Push subscription state", async ({ page }) => {
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { name: "Notification Center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Web Push Subscriptions" })).toBeVisible();

  await page.getByRole("button", { name: "Enable Push" }).click();
  await expect(
    page.getByText(/Set NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY|does not support Web Push/)
  ).toBeVisible();
});

test("PWA manifest and service worker assets are browser-visible", async ({
  page,
  request
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest"
  );

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  await expect(await manifest.json()).toMatchObject({
    display: "standalone",
    start_url: "/"
  });

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain('self.addEventListener("push"');
});
