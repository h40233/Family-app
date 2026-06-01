import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { getMemoryStore } from "@/server/store";
import { MoneyTransactionType } from "@prisma/client";
import type { ReportExportFormat, ReportsSummary } from "./types";

export async function getReportsSummary(input: {
  familyId: string;
  userId: string;
}): Promise<ReportsSummary> {
  if (usesDatabaseRuntime("reports")) {
    return getDatabaseReportsSummary(input);
  }

  const store = getMemoryStore();
  const expenseByCategory = new Map<string, number>();

  for (const transaction of store.personalTransactions) {
    if (transaction.userId !== input.userId || transaction.type !== "expense") {
      continue;
    }

    const category = transaction.category ?? "Uncategorized";
    expenseByCategory.set(
      category,
      (expenseByCategory.get(category) ?? 0) + transaction.amount
    );
  }

  return {
    monthlyExpenseByCategory: [...expenseByCategory.entries()].map(
      ([category, amount]) => ({
        category,
        amount
      })
    ),
    accountBalances: store.personalAccounts
      .filter((account) => account.userId === input.userId)
      .map((account) => ({
        id: account.id,
        name: account.name,
        balance: account.balance
      })),
    fundBalances: store.sharedFunds
      .filter((fund) => fund.familyId === input.familyId)
      .map((fund) => ({
        id: fund.id,
        name: fund.name,
        balance: fund.balance
      }))
  };
}

async function getDatabaseReportsSummary(input: {
  familyId: string;
  userId: string;
}): Promise<ReportsSummary> {
  const [transactions, accounts, funds] = await Promise.all([
    prisma.personalTransaction.findMany({
      where: {
        userId: input.userId,
        type: MoneyTransactionType.EXPENSE,
        deletedAt: null
      },
      include: { category: true }
    }),
    prisma.personalAccount.findMany({
      where: {
        userId: input.userId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.sharedFund.findMany({
      where: {
        familyId: input.familyId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const expenseByCategory = new Map<string, number>();
  for (const transaction of transactions) {
    const category = transaction.category?.name ?? "Uncategorized";
    expenseByCategory.set(
      category,
      (expenseByCategory.get(category) ?? 0) + Number(transaction.amount)
    );
  }

  return {
    monthlyExpenseByCategory: [...expenseByCategory.entries()].map(
      ([category, amount]) => ({
        category,
        amount
      })
    ),
    accountBalances: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      balance: Number(account.balance)
    })),
    fundBalances: funds.map((fund) => ({
      id: fund.id,
      name: fund.name,
      balance: Number(fund.balance)
    }))
  };
}

export async function exportReports(input: {
  familyId: string;
  userId: string;
  format: ReportExportFormat;
}) {
  const summary = await getReportsSummary(input);
  const rows = [
    ["section", "id", "name", "category", "amount", "balance"],
    ...summary.monthlyExpenseByCategory.map((item) => [
      "monthly_expense_by_category",
      "",
      "",
      item.category,
      item.amount,
      ""
    ]),
    ...summary.accountBalances.map((item) => [
      "account_balance",
      item.id,
      item.name,
      "",
      "",
      item.balance
    ]),
    ...summary.fundBalances.map((item) => [
      "fund_balance",
      item.id,
      item.name,
      "",
      "",
      item.balance
    ])
  ];

  return input.format === "xls" ? toSpreadsheetXml(rows) : toCsv(rows);
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
        })
        .join(",")
    )
    .join("\n");
}

function toSpreadsheetXml(rows: Array<Array<string | number>>) {
  const sheetRows = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const isNumber = typeof cell === "number";
            return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${escapeXml(
              String(cell)
            )}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Family OS Report">
    <Table>${sheetRows}</Table>
  </Worksheet>
</Workbook>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
