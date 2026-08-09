import type { AuthUser } from "@/server/auth";
import type { Family, FamilyMember } from "@/server/families";
import type { FundTransaction, SharedFund } from "@/server/funds";
import type {
  PersonalAccount,
  PersonalCategory,
  PersonalSharingSetting,
  PersonalTransaction
} from "@/server/money";
import type { AppNotification, PushSubscriptionRecord } from "@/server/notifications";
import type { ResourcePermissionOverride } from "@/server/permissions";
import type { PointBalance, PointLedgerEntry } from "@/server/points";
import type { BillingWebhookEventRecord } from "@/server/billing";
import type { CheckoutSession } from "@/server/plans";
import type { UserPreferences } from "@/server/preferences";
import type { Budget } from "@/server/budgets";
import { devFixtureIds, devFixtureTimestamp } from "@/server/dev-fixtures";
import type { TaskCompletion, TaskSummary } from "@/server/tasks";
import type { Wish, WishPriceProposal, WishRedemption } from "@/server/wishes";

type MemoryStore = {
  families: Family[];
  familyMembers: FamilyMember[];
  resourcePermissionOverrides: ResourcePermissionOverride[];
  personalAccounts: PersonalAccount[];
  categories: PersonalCategory[];
  personalTransactions: PersonalTransaction[];
  personalSharingSettings: PersonalSharingSetting[];
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
  billingWebhookEvents: BillingWebhookEventRecord[];
  userPreferences: UserPreferences[];
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
    categories: [
      {
        id: devFixtureIds.expenseFoodCategory,
        scope: "personal",
        type: "expense",
        name: "食",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.foodCategory,
        parentId: devFixtureIds.expenseFoodCategory,
        parentName: "食",
        scope: "personal",
        type: "expense",
        name: "早餐",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.expenseTransportCategory,
        scope: "personal",
        type: "expense",
        name: "交通",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.expensePublicTransportCategory,
        parentId: devFixtureIds.expenseTransportCategory,
        parentName: "交通",
        scope: "personal",
        type: "expense",
        name: "公共運輸",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.expenseHousingCategory,
        scope: "personal",
        type: "expense",
        name: "住",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.expenseUtilitiesCategory,
        parentId: devFixtureIds.expenseHousingCategory,
        parentName: "住",
        scope: "personal",
        type: "expense",
        name: "水電瓦斯",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.incomeSalaryCategory,
        scope: "personal",
        type: "income",
        name: "薪資",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.incomeMainSalaryCategory,
        parentId: devFixtureIds.incomeSalaryCategory,
        parentName: "薪資",
        scope: "personal",
        type: "income",
        name: "正職薪資",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.incomeInvestmentCategory,
        scope: "personal",
        type: "income",
        name: "投資",
        isSystem: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: devFixtureIds.incomeDividendCategory,
        parentId: devFixtureIds.incomeInvestmentCategory,
        parentName: "投資",
        scope: "personal",
        type: "income",
        name: "股息利息",
        isSystem: true,
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
        categoryId: devFixtureIds.foodCategory,
        category: "食 > 早餐",
        amount: 80,
        note: "Breakfast",
        occurredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    personalSharingSettings: [],
    budgets: [
      {
        id: devFixtureIds.foodBudget,
        familyId: devFixtureIds.family,
        userId: defaultUser.id,
        targetType: "personal_category",
        targetId: undefined,
        name: "Monthly Food Budget",
        category: "食 > 早餐",
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
    billingWebhookEvents: [],
    userPreferences: [],
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
