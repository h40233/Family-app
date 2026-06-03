import {
  FamilyRole,
  FundTransactionType,
  MoneyTransactionType,
  PlanType,
  PrismaClient,
  TaskApprovalMode,
  WishStatus
} from "@prisma/client";
import { devFixtureIds, devFixtureTimestamp } from "../src/server/dev-fixtures";
import { hashPassword } from "../src/server/auth/session";
import { defaultRolePermissions } from "../src/server/permissions/roles";

const prisma = new PrismaClient();
const ids = devFixtureIds;
const timestamp = new Date(devFixtureTimestamp);

async function main() {
  await prisma.user.upsert({
    where: { id: ids.ownerUser },
    update: {
      name: "家庭管理者",
      email: "dev@family-os.local",
      passwordHash: hashPassword("pass1234"),
      isChildAccount: false,
      isAdmin: true,
      bannedAt: null,
      bannedReason: null
    },
    create: {
      id: ids.ownerUser,
      name: "家庭管理者",
      email: "dev@family-os.local",
      passwordHash: hashPassword("pass1234"),
      isChildAccount: false,
      isAdmin: true
    }
  });

  await prisma.user.upsert({
    where: { id: ids.childUser },
    update: {
      name: "小孩帳號",
      isChildAccount: true,
      parentUserId: ids.ownerUser,
      isAdmin: false,
      bannedAt: null,
      bannedReason: null
    },
    create: {
      id: ids.childUser,
      name: "小孩帳號",
      email: null,
      passwordHash: null,
      isChildAccount: true,
      isAdmin: false,
      parentUserId: ids.ownerUser
    }
  });

  await prisma.family.upsert({
    where: { id: ids.family },
    update: {
      name: "示範家庭",
      plan: PlanType.FREE,
      ownerUserId: ids.ownerUser
    },
    create: {
      id: ids.family,
      name: "示範家庭",
      plan: PlanType.FREE,
      ownerUserId: ids.ownerUser
    }
  });

  await prisma.familyMember.upsert({
    where: { id: ids.ownerMember },
    update: {
      role: FamilyRole.OWNER,
      permissions: {}
    },
    create: {
      id: ids.ownerMember,
      familyId: ids.family,
      userId: ids.ownerUser,
      role: FamilyRole.OWNER,
      permissions: {}
    }
  });

  await prisma.familyMember.upsert({
    where: { id: ids.childMember },
    update: {
      role: FamilyRole.CHILD,
      permissions: {}
    },
    create: {
      id: ids.childMember,
      familyId: ids.family,
      userId: ids.childUser,
      role: FamilyRole.CHILD,
      permissions: {}
    }
  });

  for (const role of [
    FamilyRole.OWNER,
    FamilyRole.ADMIN,
    FamilyRole.MEMBER,
    FamilyRole.CHILD,
    FamilyRole.VIEWER
  ]) {
    const roleKey = role.toLowerCase() as keyof typeof defaultRolePermissions;
    await prisma.familyRolePermission.upsert({
      where: {
        familyId_role: {
          familyId: ids.family,
          role
        }
      },
      update: {
        permissions: defaultRolePermissions[roleKey]
      },
      create: {
        familyId: ids.family,
        role,
        permissions: defaultRolePermissions[roleKey]
      }
    });
  }

  await prisma.personalAccount.upsert({
    where: { id: ids.cashAccount },
    update: {
      name: "現金",
      type: "cash",
      balance: 1000
    },
    create: {
      id: ids.cashAccount,
      userId: ids.ownerUser,
      name: "現金",
      type: "cash",
      balance: 1000
    }
  });

  await prisma.personalAccount.upsert({
    where: { id: ids.bankAccount },
    update: {
      name: "銀行 A",
      type: "bank",
      balance: 50000
    },
    create: {
      id: ids.bankAccount,
      userId: ids.ownerUser,
      name: "銀行 A",
      type: "bank",
      balance: 50000
    }
  });

  await upsertCategory({
    id: ids.expenseFoodCategory,
    scope: "personal",
    type: "expense",
    name: "食",
    isSystem: true
  });
  await upsertCategory({
    id: ids.foodCategory,
    scope: "personal",
    type: "expense",
    name: "早餐",
    parentId: ids.expenseFoodCategory,
    isSystem: true
  });
  await upsertCategory({
    id: ids.expenseTransportCategory,
    scope: "personal",
    type: "expense",
    name: "交通",
    isSystem: true
  });
  await upsertCategory({
    id: ids.expensePublicTransportCategory,
    scope: "personal",
    type: "expense",
    name: "公共運輸",
    parentId: ids.expenseTransportCategory,
    isSystem: true
  });
  await upsertCategory({
    id: ids.expenseHousingCategory,
    scope: "personal",
    type: "expense",
    name: "住",
    isSystem: true
  });
  await upsertCategory({
    id: ids.expenseUtilitiesCategory,
    scope: "personal",
    type: "expense",
    name: "水電瓦斯",
    parentId: ids.expenseHousingCategory,
    isSystem: true
  });
  await upsertCategory({
    id: ids.incomeSalaryCategory,
    scope: "personal",
    type: "income",
    name: "薪資",
    isSystem: true
  });
  await upsertCategory({
    id: ids.incomeMainSalaryCategory,
    scope: "personal",
    type: "income",
    name: "正職薪資",
    parentId: ids.incomeSalaryCategory,
    isSystem: true
  });
  await upsertCategory({
    id: ids.incomeInvestmentCategory,
    scope: "personal",
    type: "income",
    name: "投資",
    isSystem: true
  });
  await upsertCategory({
    id: ids.incomeDividendCategory,
    scope: "personal",
    type: "income",
    name: "股息利息",
    parentId: ids.incomeInvestmentCategory,
    isSystem: true
  });

  await prisma.category.upsert({
    where: { id: ids.fundCategory },
    update: {
      name: "家庭基金",
      type: "deposit",
      scope: "shared_fund",
      isSystem: true
    },
    create: {
      id: ids.fundCategory,
      familyId: ids.family,
      scope: "shared_fund",
      type: "deposit",
      name: "家庭基金",
      isSystem: true
    }
  });

  await prisma.personalTransaction.upsert({
    where: { id: ids.breakfastTransaction },
    update: {
      note: "早餐",
      amount: 80,
      occurredAt: timestamp
    },
    create: {
      id: ids.breakfastTransaction,
      accountId: ids.cashAccount,
      userId: ids.ownerUser,
      type: MoneyTransactionType.EXPENSE,
      categoryId: ids.foodCategory,
      amount: 80,
      note: "早餐",
      occurredAt: timestamp
    }
  });

  await prisma.budget.upsert({
    where: { id: ids.foodBudget },
    update: {
      name: "每月餐飲預算",
      amount: 3000,
      periodType: "monthly",
      startAt: new Date("2026-05-01T00:00:00.000Z"),
      endAt: new Date("2026-05-31T23:59:59.999Z")
    },
    create: {
      id: ids.foodBudget,
      familyId: ids.family,
      userId: ids.ownerUser,
      name: "每月餐飲預算",
      targetType: "personal_category",
      targetId: ids.foodCategory,
      amount: 3000,
      periodType: "monthly",
      startAt: new Date("2026-05-01T00:00:00.000Z"),
      endAt: new Date("2026-05-31T23:59:59.999Z")
    }
  });

  await prisma.sharedFund.upsert({
    where: { id: ids.dailyFund },
    update: {
      name: "日常家庭基金",
      balance: 42000,
      permissions: {}
    },
    create: {
      id: ids.dailyFund,
      familyId: ids.family,
      name: "日常家庭基金",
      balance: 42000,
      permissions: {},
      createdBy: ids.ownerUser
    }
  });

  await prisma.fundTransaction.upsert({
    where: { id: ids.fundDeposit },
    update: {
      amount: 42000,
      note: "初始基金",
      occurredAt: timestamp
    },
    create: {
      id: ids.fundDeposit,
      familyId: ids.family,
      fundId: ids.dailyFund,
      actorUserId: ids.ownerUser,
      type: FundTransactionType.DEPOSIT,
      categoryId: ids.fundCategory,
      amount: 42000,
      note: "初始基金",
      occurredAt: timestamp
    }
  });

  await prisma.task.upsert({
    where: { id: ids.autoTask },
    update: {
      title: "倒垃圾",
      description: "每日家務",
      maxPoints: 10,
      approvalMode: TaskApprovalMode.AUTO
    },
    create: {
      id: ids.autoTask,
      familyId: ids.family,
      title: "倒垃圾",
      description: "每日家務",
      maxPoints: 10,
      approvalMode: TaskApprovalMode.AUTO,
      createdBy: ids.ownerUser
    }
  });

  await prisma.taskAssignment.upsert({
    where: { id: ids.autoTaskAssignment },
    update: {
      userId: ids.ownerUser
    },
    create: {
      id: ids.autoTaskAssignment,
      taskId: ids.autoTask,
      userId: ids.ownerUser
    }
  });

  await prisma.pointBalance.upsert({
    where: {
      familyId_userId: {
        familyId: ids.family,
        userId: ids.ownerUser
      }
    },
    update: {
      balance: 0
    },
    create: {
      familyId: ids.family,
      userId: ids.ownerUser,
      balance: 0
    }
  });

  await prisma.wish.upsert({
    where: { id: ids.wish5090 },
    update: {
      title: "RTX 5090",
      description: "爸爸的願望",
      status: WishStatus.ACTIVE,
      agreedPoints: 50000
    },
    create: {
      id: ids.wish5090,
      familyId: ids.family,
      requesterId: ids.ownerUser,
      fulfillerId: ids.ownerUser,
      title: "RTX 5090",
      description: "爸爸的願望",
      status: WishStatus.ACTIVE,
      agreedPoints: 50000
    }
  });

  await prisma.notification.upsert({
    where: { id: ids.welcomeNotification },
    update: {
      title: "歡迎使用家庭 OS",
      body: "MVP 通知中心已串接後端資料。"
    },
    create: {
      id: ids.welcomeNotification,
      userId: ids.ownerUser,
      familyId: ids.family,
      type: "points_changed",
      title: "歡迎使用家庭 OS",
      body: "MVP 通知中心已串接後端資料。"
    }
  });

  console.log("已建立家庭 OS MVP 示範資料。");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function upsertCategory(input: {
  id: string;
  scope: string;
  type: string;
  name: string;
  parentId?: string;
  isSystem?: boolean;
}) {
  await prisma.category.upsert({
    where: { id: input.id },
    update: {
      scope: input.scope,
      type: input.type,
      name: input.name,
      parentId: input.parentId ?? null,
      isSystem: input.isSystem ?? false,
      deletedAt: null
    },
    create: {
      id: input.id,
      scope: input.scope,
      type: input.type,
      name: input.name,
      parentId: input.parentId,
      isSystem: input.isSystem ?? false
    }
  });
}
