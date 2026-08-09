import { expect, test } from "@playwright/test";

type E2EPersonalAccount = {
  id: string;
  type: "cash" | "bank" | "e_wallet" | "other";
  balance: number;
};

const accountTypeLabels: Record<E2EPersonalAccount["type"], string> = {
  cash: "現金",
  bank: "銀行",
  e_wallet: "電子錢包",
  other: "其他"
};

function formatTwd(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("renders core MVP pages from a real browser", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/");
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
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
  test.setTimeout(90_000);

  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: "方案與限制" })).toBeVisible();

  const upgrade = page.getByRole("button", { name: "升級" });
  await expect(upgrade).toBeEnabled({ timeout: 60_000 });
  if (await upgrade.isEnabled()) {
    const checkoutResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/billing/checkout") &&
        response.request().method() === "POST" &&
        response.status() === 201,
      { timeout: 60_000 }
    );
    await upgrade.click();
    await checkoutResponse;
  }

  await expect(page.getByText("可使用").first()).toBeVisible({ timeout: 60_000 });

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "家庭報表" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/api/v1/families/00000000-0000-4000-8000-000000001001/reports/export?format=xls";
    link.download = "family-os-report.xls";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("family-os-report.xls");
});

test("notification center exposes Web Push subscription state", async ({ page }) => {
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { name: "通知中心" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Web Push 訂閱" })).toBeVisible();

  await page.getByRole("button", { name: "啟用推播" }).click();
  await expect(
    page.getByText(/VAPID key|不支援 Web Push/)
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

test("personal offline transactions sync when the browser comes back online", async ({
  context,
  page,
  request
}) => {
  test.setTimeout(90_000);
  const authHeaders = {
    "x-family-os-user-id": "00000000-0000-4000-8000-000000000001",
    "x-family-os-user-name": "Development User"
  };
  await context.setExtraHTTPHeaders(authHeaders);

  const accountsResponse = await request.get("/api/v1/personal/accounts", {
    headers: authHeaders,
    timeout: 60_000
  });
  expect(accountsResponse.ok()).toBe(true);
  const accountsPayload = (await accountsResponse.json()) as { data: E2EPersonalAccount[] };
  const firstAccount = accountsPayload.data[0];
  if (!firstAccount) {
    throw new Error("Expected the personal account fixture to include at least one account.");
  }

  const categoriesResponse = await request.get("/api/v1/personal/categories", {
    headers: authHeaders,
    timeout: 60_000
  });
  expect(categoriesResponse.ok()).toBe(true);

  const transactionsResponse = await request.get(
    `/api/v1/personal/accounts/${firstAccount.id}/transactions`,
    {
      headers: authHeaders,
      timeout: 60_000
    }
  );
  expect(transactionsResponse.ok()).toBe(true);

  const browserAccountsResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/personal/accounts") && response.status() === 200,
    { timeout: 60_000 }
  );
  await page.goto("/money/personal");
  await browserAccountsResponsePromise;
  await expect(page.getByRole("heading", { name: "個人帳本" })).toBeVisible();
  await expect(page.getByRole("button", { name: /同步離線交易 0/ })).toBeVisible();
  await expect(
    page.getByText(
      new RegExp(
        `${escapeRegExp(accountTypeLabels[firstAccount.type])} / ${escapeRegExp(formatTwd(firstAccount.balance))}`
      )
    )
  ).toBeVisible({ timeout: 60_000 });

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  await page.getByPlaceholder("金額").fill("42");
  await page.getByPlaceholder("備註").fill("離線同步測試");
  await page.getByRole("button", { name: "新增交易" }).click();

  await expect(page.getByRole("button", { name: /同步離線交易 1/ })).toBeVisible();

  const syncResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/personal/offline-sync") && response.request().method() === "POST",
    { timeout: 60_000 }
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  expect((await syncResponsePromise).ok()).toBe(true);

  await expect(page.getByRole("button", { name: /同步離線交易 0/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("離線同步測試")).toBeVisible({ timeout: 60_000 });
});
