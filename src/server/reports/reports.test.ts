import { beforeEach, describe, expect, it } from "vitest";
import { createFundTransaction } from "@/server/funds";
import { createPersonalTransaction } from "@/server/money";
import { getFamilyPlanStatus, assertReportExportAllowed } from "@/server/plans";
import { getMemoryStore, resetMemoryStore } from "@/server/store";
import { exportReports, getReportsSummary } from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";
const userId = "00000000-0000-4000-8000-000000000001";

describe("reports service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("summarizes personal expenses and balances", async () => {
    await createPersonalTransaction({
      userId,
      accountId: "00000000-0000-4000-8000-000000002001",
      type: "expense",
      category: "Transport",
      amount: 120
    });
    await createFundTransaction({
      familyId,
      fundId: "00000000-0000-4000-8000-000000003001",
      actorUserId: userId,
      type: "deposit",
      amount: 1000
    });

    const summary = await getReportsSummary({ familyId, userId });

    expect(summary.monthlyExpenseByCategory).toEqual(
      expect.arrayContaining([
        { category: "食 > 早餐", amount: 80 },
        { category: "Transport", amount: 120 }
      ])
    );
    expect(
      summary.accountBalances.find((account) => account.id === "00000000-0000-4000-8000-000000002001")
        ?.balance
    ).toBe(880);
    expect(summary.fundBalances.find((fund) => fund.id === "00000000-0000-4000-8000-000000003001")?.balance).toBe(
      43000
    );
  });

  it("blocks report export on the free plan", async () => {
    const status = await getFamilyPlanStatus(familyId);

    expect(status.plan).toBe("free");
    expect(status.limits.canExportReports).toBe(false);
    await expect(assertReportExportAllowed(familyId)).rejects.toThrow(
      "paid plan"
    );
  });

  it("exports report CSV on the paid plan", async () => {
    getMemoryStore().families[0].plan = "paid";

    await expect(assertReportExportAllowed(familyId)).resolves.toMatchObject({
      plan: "paid"
    });

    const csv = await exportReports({ familyId, userId, format: "csv" });

    expect(csv).toContain("section,id,name,category,amount,balance");
    expect(csv).toContain("monthly_expense_by_category,,,食 > 早餐,80,");
    expect(csv).toContain("account_balance,00000000-0000-4000-8000-000000002001,Cash,,,1000");
    expect(csv).toContain("fund_balance,00000000-0000-4000-8000-000000003001,Daily Family Fund,,,42000");
  });

  it("exports an Excel-compatible workbook on the paid plan", async () => {
    getMemoryStore().families[0].plan = "paid";

    const xls = await exportReports({ familyId, userId, format: "xls" });

    expect(xls).toContain("<?mso-application progid=\"Excel.Sheet\"?>");
    expect(xls).toContain("<Worksheet ss:Name=\"Family OS Report\">");
    expect(xls).toContain("00000000-0000-4000-8000-000000002001");
  });
});
