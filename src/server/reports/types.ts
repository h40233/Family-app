export type CategoryExpense = {
  category: string;
  amount: number;
};

export type ReportsSummary = {
  monthlyExpenseByCategory: CategoryExpense[];
  accountBalances: Array<{ id: string; name: string; balance: number }>;
  fundBalances: Array<{ id: string; name: string; balance: number }>;
};

export type ReportExportFormat = "csv" | "xls";
