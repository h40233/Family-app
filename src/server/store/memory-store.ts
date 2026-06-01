import type { AuthUser } from "@/server/auth";
import type { Family, FamilyMember } from "@/server/families";
import type { FundTransaction, SharedFund } from "@/server/funds";
import type { PersonalAccount, PersonalTransaction } from "@/server/money";
import type { AppNotification, PushSubscriptionRecord } from "@/server/notifications";
import type { ResourcePermissionOverride } from "@/server/permissions";
import type { PointBalance, PointLedgerEntry } from "@/server/points";
import type { CheckoutSession } from "@/server/plans";
import type { Budget } from "@/server/budgets";
import { devFixtureIds, devFixtureTimestamp } from "@/server/dev-fixtures";
import type { TaskCompletion, TaskSummary } from "@/server/tasks";
import type { Wish, WishPriceProposal, WishRedemption } from "@/server/wishes";

type MemoryStore = {
  families: Family[];
  familyMembers: FamilyMember[];
  resourcePermissionOverrides: ResourcePermissionOverride[];
  personalAccounts: PersonalAccount[];
  personalTransactions: PersonalTransaction[];
  budgets: Budget[];
  sharedFunds: SharedFund[];
  fundTransactions: FundTransaction[];
  notifications: AppNotification[];
  pushSubscriptions: PushSubscriptionRecord[];
  tasks: TaskSummary[];
  taskCompletions: TaskCompletion[];
  pointBalances: PointBalance[];
  pointLedger: PointLedgerEntry[];
  checkoutSessions: CheckoutSession[];
  wishes: Wish[];
  wishPriceProposals: WishPriceProposal[];
  wishRedemptions: WishRedemption[];
};

const timestamp = devFixtureTimestamp;

const defaultUser: AuthUser = {
  id: devFixtureIds.ownerUser,
  displayName: "Development User",
  email: "dev@family-os.local",
  isChildAccount: false
};

const childUser: AuthUser = {
  id: devFixtureIds.childUser,
  displayName: "Development Child",
  email: null,
  isChildAccount: true
};

function createInitialStore(): MemoryStore {
  return {
    families: [
      {
        id: devFixtureIds.family,
        name: "Development Family",
        plan: "free",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    familyMembers: [
      {
        id: devFixtureIds.ownerMember,
        familyId: devFixtureIds.family,
        userId: defaultUser.id,
        displayName: defaultUser.displayName,
        role: "owner",
        isChildAccount: false
      },
      {
        id: devFixtureIds.childMember,
        familyId: devFixtureIds.family,
        userId: childUser.id,
        displayName: childUser.displayName,
        role: "child",
        isChildAccount: true
      }
    ],
    resourcePermissionOverrides: [],
    personalAccounts: [
      {
        id: devFixtureIds.cashAccount,
        userId: defaultUser.id,
        name: "Cash",
        type: "cash",
        balance: 1000,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.bankAccount,
        userId: defaultUser.id,
        name: "Bank A",
        type: "bank",
        balance: 50000,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    personalTransactions: [
      {
        id: devFixtureIds.breakfastTransaction,
        accountId: devFixtureIds.cashAccount,
        userId: defaultUser.id,
        type: "expense",
        category: "Food",
        amount: 80,
        note: "Breakfast",
        occurredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    budgets: [
      {
        id: devFixtureIds.foodBudget,
        familyId: devFixtureIds.family,
        userId: defaultUser.id,
        targetType: "personal_category",
        targetId: undefined,
        name: "Monthly Food Budget",
        category: "Food",
        amount: 3000,
        periodType: "monthly",
        startAt: "2026-05-01T00:00:00.000Z",
        endAt: "2026-05-31T23:59:59.999Z",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    sharedFunds: [
      {
        id: devFixtureIds.dailyFund,
        familyId: devFixtureIds.family,
        name: "Daily Family Fund",
        balance: 42000,
        createdBy: defaultUser.id,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    fundTransactions: [
      {
        id: devFixtureIds.fundDeposit,
        familyId: devFixtureIds.family,
        fundId: devFixtureIds.dailyFund,
        actorUserId: defaultUser.id,
        type: "deposit",
        category: "Family Fund",
        amount: 42000,
        note: "Initial fund",
        occurredAt: timestamp,
        createdAt: timestamp
      }
    ],
    notifications: [
      {
        id: devFixtureIds.welcomeNotification,
        userId: defaultUser.id,
        familyId: devFixtureIds.family,
        type: "points_changed",
        title: "Welcome to Family OS",
        body: "The MVP notification center is connected to backend data.",
        createdAt: timestamp
      }
    ],
    pushSubscriptions: [],
    tasks: [
      {
        id: devFixtureIds.autoTask,
        familyId: devFixtureIds.family,
        title: "Take out trash",
        description: "Daily chore",
        assigneeIds: [defaultUser.id],
        assignmentMode: "single",
        maxPoints: 10,
        approvalMode: "auto",
        status: "open",
        dueAt: undefined,
        repeatRule: undefined,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    taskCompletions: [],
    pointBalances: [
      {
        familyId: devFixtureIds.family,
        userId: defaultUser.id,
        balance: 0,
        updatedAt: timestamp
      }
    ],
    pointLedger: [],
    checkoutSessions: [],
    wishes: [
      {
        id: devFixtureIds.wish5090,
        familyId: devFixtureIds.family,
        requesterId: defaultUser.id,
        fulfillerId: defaultUser.id,
        title: "RTX 5090",
        description: "Dad's wish",
        status: "active",
        agreedPoints: 50000,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    wishPriceProposals: [],
    wishRedemptions: []
  };
}

declare global {
  var familyOsMemoryStore: MemoryStore | undefined;
}

export function getMemoryStore() {
  if (!globalThis.familyOsMemoryStore) {
    globalThis.familyOsMemoryStore = createInitialStore();
  }

  return globalThis.familyOsMemoryStore;
}

export function resetMemoryStore() {
  globalThis.familyOsMemoryStore = createInitialStore();
  return globalThis.familyOsMemoryStore;
}

export function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function ensurePointBalance(familyId: string, userId: string) {
  const store = getMemoryStore();
  let balance = store.pointBalances.find(
    (item) => item.familyId === familyId && item.userId === userId
  );

  if (!balance) {
    balance = {
      familyId,
      userId,
      balance: 0,
      updatedAt: nowIso()
    };
    store.pointBalances.push(balance);
  }

  return balance;
}
