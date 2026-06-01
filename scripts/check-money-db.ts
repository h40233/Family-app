import { randomUUID } from "node:crypto";
import { devFixtureIds } from "../src/server/dev-fixtures";
import { prisma } from "../src/server/db/prisma";
import {
  childLogin,
  createSessionCookie,
  getCurrentUser,
  login,
  logout
} from "../src/server/auth";
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget
} from "../src/server/budgets";
import {
  createPushSubscription,
  deletePushSubscription,
  listNotifications,
  listPushSubscriptions,
  markAllNotificationsRead
} from "../src/server/notifications";
import {
  createFundTransaction,
  listFundTransactions,
  listSharedFunds
} from "../src/server/funds";
import {
  createPersonalTransaction,
  listPersonalAccounts,
  listPersonalTransactions
} from "../src/server/money";
import { adjustPoints, getMyPointBalance, listPointLedger } from "../src/server/points";
import { getReportsSummary } from "../src/server/reports";
import { completeTask, listTasks } from "../src/server/tasks";
import { completeWish, listWishes, redeemWish } from "../src/server/wishes";

process.env.FAMILY_OS_MONEY_DATA_SOURCE = "database";
process.env.FAMILY_OS_REPORTS_DATA_SOURCE = "database";
process.env.FAMILY_OS_BUDGETS_DATA_SOURCE = "database";
process.env.FAMILY_OS_FUNDS_DATA_SOURCE = "database";
process.env.FAMILY_OS_POINTS_DATA_SOURCE = "database";
process.env.FAMILY_OS_TASKS_DATA_SOURCE = "database";
process.env.FAMILY_OS_WISHES_DATA_SOURCE = "database";
process.env.FAMILY_OS_NOTIFICATIONS_DATA_SOURCE = "database";
process.env.FAMILY_OS_AUTH_DATA_SOURCE = "database";

async function main() {
  const loginSession = await login({
    email: "dev@family-os.local",
    password: "pass1234"
  });
  const loginCookie = createSessionCookie(loginSession).split(";")[0];
  const currentUser = await getCurrentUser(
    new Request("http://localhost/api/v1/auth/me", {
      headers: { cookie: loginCookie }
    })
  );

  if (currentUser?.id !== devFixtureIds.ownerUser) {
    throw new Error("DB-backed auth login session did not resolve the seeded owner user.");
  }

  const childSession = await childLogin({
    familyCode: devFixtureIds.family,
    username: "Development Child",
    pin: "1234"
  });

  if (childSession.user.id !== devFixtureIds.childUser || !childSession.user.isChildAccount) {
    throw new Error("DB-backed child login did not resolve the seeded child user.");
  }

  await logout(
    new Request("http://localhost/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: loginCookie }
    })
  );
  const revokedUser = await getCurrentUser(
    new Request("http://localhost/api/v1/auth/me", {
      headers: { cookie: loginCookie }
    })
  );

  if (revokedUser) {
    throw new Error("DB-backed logout did not revoke the session.");
  }

  const accounts = await listPersonalAccounts(devFixtureIds.ownerUser);
  const cash = accounts.find((account) => account.id === devFixtureIds.cashAccount);

  if (!cash) {
    throw new Error("Seeded cash account was not found through the DB-backed money service.");
  }

  const clientMutationId = randomUUID();
  const beforeBalance = cash.balance;
  const transaction = await createPersonalTransaction({
    userId: devFixtureIds.ownerUser,
    accountId: devFixtureIds.cashAccount,
    clientMutationId,
    type: "expense",
    category: "DB Smoke",
    amount: 5,
    note: `DB smoke ${clientMutationId}`
  });

  const [updatedCash] = (await listPersonalAccounts(devFixtureIds.ownerUser)).filter(
    (account) => account.id === devFixtureIds.cashAccount
  );

  if (!updatedCash || updatedCash.balance !== beforeBalance - 5) {
    throw new Error(
      `Expected cash balance ${beforeBalance - 5}, received ${updatedCash?.balance ?? "none"}.`
    );
  }

  const transactions = await listPersonalTransactions({
    userId: devFixtureIds.ownerUser,
    accountId: devFixtureIds.cashAccount
  });

  if (!transactions.some((item) => item.id === transaction.id)) {
    throw new Error("Created DB-backed transaction was not returned by the list API.");
  }

  const summary = await getReportsSummary({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser
  });

  if (!summary.monthlyExpenseByCategory.some((item) => item.category === "DB Smoke")) {
    throw new Error("DB-backed report summary did not include the created transaction category.");
  }

  const reportedCash = summary.accountBalances.find(
    (account) => account.id === devFixtureIds.cashAccount
  );

  if (!reportedCash || reportedCash.balance !== updatedCash.balance) {
    throw new Error("DB-backed report summary did not reflect the updated account balance.");
  }

  const budgets = await listBudgets({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser
  });
  const foodBudget = budgets.find((item) => item.budget.id === devFixtureIds.foodBudget);

  if (!foodBudget) {
    throw new Error("Seeded DB-backed budget was not returned by the budget service.");
  }

  if (foodBudget.spent !== 80) {
    throw new Error(`Expected seeded Food budget spent to remain 80, got ${foodBudget.spent}.`);
  }

  const overageCategory = `Budget Overage Smoke ${randomUUID()}`;
  const overageBudget = await createBudget({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser,
    name: "DB Overage Smoke Budget",
    targetType: "personal_category",
    category: overageCategory,
    amount: 10,
    periodType: "monthly",
    startAt: "2026-05-01T00:00:00.000Z",
    endAt: "2026-05-31T23:59:59.999Z"
  });

  await createPersonalTransaction({
    userId: devFixtureIds.ownerUser,
    accountId: devFixtureIds.cashAccount,
    type: "expense",
    category: overageCategory,
    amount: 15,
    note: `DB budget overage smoke ${randomUUID()}`,
    occurredAt: "2026-05-15T00:00:00.000Z"
  });

  const overageBudgets = await listBudgets({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser
  });
  const exceededBudget = overageBudgets.find(
    (item) => item.budget.id === overageBudget.budget.id
  );

  if (!exceededBudget || exceededBudget.spent !== 15 || !exceededBudget.exceeded) {
    throw new Error("DB-backed budget overage was not reflected in budget usage.");
  }

  const overageNotifications = await listNotifications(devFixtureIds.ownerUser);
  if (
    !overageNotifications.some(
      (notification) =>
        notification.type === "budget_exceeded" &&
        notification.data?.budgetId === overageBudget.budget.id
    )
  ) {
    throw new Error("DB-backed budget overage notification was not created.");
  }

  const updatedBudget = await updateBudget({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser,
    budgetId: overageBudget.budget.id,
    amount: 20,
    name: "DB Updated Overage Smoke Budget"
  });

  if (updatedBudget.remaining !== 5 || updatedBudget.exceeded) {
    throw new Error("DB-backed budget update did not recalculate usage.");
  }

  const deletedBudget = await deleteBudget({
    familyId: devFixtureIds.family,
    budgetId: overageBudget.budget.id
  });

  if (!deletedBudget.deleted) {
    throw new Error("DB-backed budget delete did not report success.");
  }

  const afterDeleteBudgets = await listBudgets({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser
  });

  if (afterDeleteBudgets.some((item) => item.budget.id === overageBudget.budget.id)) {
    throw new Error("DB-backed budget delete did not remove the budget from list.");
  }

  const fundsBefore = await listSharedFunds(devFixtureIds.family);
  const dailyFund = fundsBefore.find((fund) => fund.id === devFixtureIds.dailyFund);

  if (!dailyFund) {
    throw new Error("Seeded shared fund was not found through the DB-backed fund service.");
  }

  const fundTransaction = await createFundTransaction({
    familyId: devFixtureIds.family,
    fundId: devFixtureIds.dailyFund,
    actorUserId: devFixtureIds.ownerUser,
    type: "deposit",
    category: "DB Fund Smoke",
    amount: 7,
    note: `DB fund smoke ${randomUUID()}`
  });

  const fundTransactions = await listFundTransactions({
    familyId: devFixtureIds.family,
    fundId: devFixtureIds.dailyFund
  });

  if (!fundTransactions.some((item) => item.id === fundTransaction.id)) {
    throw new Error("Created DB-backed fund transaction was not returned by the list API.");
  }

  const [updatedFund] = (await listSharedFunds(devFixtureIds.family)).filter(
    (fund) => fund.id === devFixtureIds.dailyFund
  );

  if (!updatedFund || updatedFund.balance !== dailyFund.balance + 7) {
    throw new Error(
      `Expected shared fund balance ${dailyFund.balance + 7}, received ${
        updatedFund?.balance ?? "none"
      }.`
    );
  }

  const fundSummary = await getReportsSummary({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser
  });
  const reportedFund = fundSummary.fundBalances.find(
    (fund) => fund.id === devFixtureIds.dailyFund
  );

  if (!reportedFund || reportedFund.balance !== updatedFund.balance) {
    throw new Error("DB-backed report summary did not reflect the updated fund balance.");
  }

  const balanceBefore = await getMyPointBalance({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser
  });
  const pointEntry = await adjustPoints({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser,
    userId: devFixtureIds.ownerUser,
    delta: 11,
    reason: `DB points smoke ${randomUUID()}`
  });
  const balanceAfter = await getMyPointBalance({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser
  });

  if (balanceAfter.balance !== balanceBefore.balance + 11) {
    throw new Error(
      `Expected point balance ${balanceBefore.balance + 11}, got ${balanceAfter.balance}.`
    );
  }

  if (pointEntry.balanceAfter !== balanceAfter.balance) {
    throw new Error("DB-backed point ledger entry did not return the updated balance.");
  }

  const pointLedger = await listPointLedger({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser,
    limit: 10
  });

  if (!pointLedger.entries.some((entry) => entry.id === pointEntry.id)) {
    throw new Error("Created DB-backed point ledger entry was not returned by the ledger API.");
  }

  const tasks = await listTasks({ familyId: devFixtureIds.family });
  const autoTask = tasks.find((task) => task.id === devFixtureIds.autoTask);

  if (!autoTask) {
    throw new Error("Seeded DB-backed task was not returned by the task service.");
  }

  const beforeTaskAwardBalance = await getMyPointBalance({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser
  });
  const completion = await completeTask({
    familyId: devFixtureIds.family,
    taskId: devFixtureIds.autoTask,
    actorUserId: devFixtureIds.ownerUser,
    note: `DB task smoke ${randomUUID()}`
  });
  const afterTaskAwardBalance = await getMyPointBalance({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser
  });

  if (completion.status !== "approved" || completion.awardedPoints !== autoTask.maxPoints) {
    throw new Error("DB-backed auto task did not create an approved completion with max points.");
  }

  if (afterTaskAwardBalance.balance !== beforeTaskAwardBalance.balance + autoTask.maxPoints) {
    throw new Error("DB-backed auto task completion did not award points.");
  }

  const taskAwardLedger = await listPointLedger({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser,
    limit: 20
  });

  if (
    !taskAwardLedger.entries.some(
      (entry) =>
        entry.relatedEntityId === completion.id && entry.reason === "task_auto_award"
    )
  ) {
    throw new Error("DB-backed auto task award was not written to the point ledger.");
  }

  const wishes = await listWishes({ familyId: devFixtureIds.family });
  const wish = wishes.find((item) => item.id === devFixtureIds.wish5090);

  if (!wish || wish.status !== "active" || !wish.agreedPoints) {
    throw new Error("Seeded active DB-backed wish was not returned by the wish service.");
  }

  await adjustPoints({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser,
    userId: devFixtureIds.ownerUser,
    delta: wish.agreedPoints,
    reason: `DB wish funding smoke ${randomUUID()}`
  });
  const beforeWishBalance = await getMyPointBalance({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser
  });
  const redemption = await redeemWish({
    familyId: devFixtureIds.family,
    wishId: devFixtureIds.wish5090,
    actorUserId: devFixtureIds.ownerUser
  });
  const afterWishBalance = await getMyPointBalance({
    familyId: devFixtureIds.family,
    actorUserId: devFixtureIds.ownerUser
  });

  if (redemption.pointsSpent !== wish.agreedPoints) {
    throw new Error("DB-backed wish redemption did not spend the agreed point price.");
  }

  if (afterWishBalance.balance !== beforeWishBalance.balance - wish.agreedPoints) {
    throw new Error("DB-backed wish redemption did not deduct points.");
  }

  const redemptionLedger = await listPointLedger({
    familyId: devFixtureIds.family,
    userId: devFixtureIds.ownerUser,
    limit: 30
  });

  if (
    !redemptionLedger.entries.some(
      (entry) =>
        entry.relatedEntityId === redemption.id && entry.reason === "wish_redemption"
    )
  ) {
    throw new Error("DB-backed wish redemption was not written to the point ledger.");
  }

  const completedWish = await completeWish({
    familyId: devFixtureIds.family,
    wishId: devFixtureIds.wish5090,
    actorUserId: devFixtureIds.ownerUser
  });

  if (completedWish.status !== "completed") {
    throw new Error("DB-backed wish fulfillment did not mark the wish completed.");
  }

  const notifications = await listNotifications(devFixtureIds.ownerUser);

  if (!notifications.some((notification) => notification.type === "points_changed")) {
    throw new Error("DB-backed notifications did not record point changes.");
  }

  const readResult = await markAllNotificationsRead(devFixtureIds.ownerUser);
  if (readResult.updated < 1) {
    throw new Error("DB-backed notifications were not marked read.");
  }

  const endpoint = `https://push.example.test/${randomUUID()}`;
  const subscription = await createPushSubscription({
    userId: devFixtureIds.ownerUser,
    endpoint,
    keys: {
      p256dh: "p256dh-smoke",
      auth: "auth-smoke"
    }
  });
  const subscriptions = await listPushSubscriptions(devFixtureIds.ownerUser);

  if (!subscriptions.some((item) => item.id === subscription.id)) {
    throw new Error("DB-backed push subscription was not returned by list.");
  }

  const deleted = await deletePushSubscription({
    userId: devFixtureIds.ownerUser,
    subscriptionId: subscription.id
  });

  if (!deleted.deleted) {
    throw new Error("DB-backed push subscription was not deleted.");
  }

  console.log(
    "DB-backed auth, money, fund, points, tasks, wishes, notifications, report, and budget service smoke passed."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
