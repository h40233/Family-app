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
      name: "Development User",
      email: "dev@family-os.local",
      passwordHash: hashPassword("pass1234"),
      isChildAccount: false,
      isAdmin: true,
      bannedAt: null,
      bannedReason: null
    },
    create: {
      id: ids.ownerUser,
      name: "Development User",
      email: "dev@family-os.local",
      passwordHash: hashPassword("pass1234"),
      isChildAccount: false,
      isAdmin: true
    }
  });

  await prisma.user.upsert({
    where: { id: ids.childUser },
    update: {
      name: "Development Child",
      isChildAccount: true,
      parentUserId: ids.ownerUser,
      isAdmin: false,
      bannedAt: null,
      bannedReason: null
    },
    create: {
      id: ids.childUser,
      name: "Development Child",
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
      name: "Development Family",
      plan: PlanType.FREE,
      ownerUserId: ids.ownerUser
    },
    create: {
      id: ids.family,
      name: "Development Family",
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
      name: "Cash",
      type: "cash",
      balance: 1000
    },
    create: {
      id: ids.cashAccount,
      userId: ids.ownerUser,
      name: "Cash",
      type: "cash",
      balance: 1000
    }
  });

  await prisma.personalAccount.upsert({
    where: { id: ids.bankAccount },
    update: {
      name: "Bank A",
      type: "bank",
      balance: 50000
    },
    create: {
      id: ids.bankAccount,
      userId: ids.ownerUser,
      name: "Bank A",
      type: "bank",
      balance: 50000
    }
  });

  await prisma.category.upsert({
    where: { id: ids.foodCategory },
    update: {
      name: "Food",
      type: "expense",
      scope: "personal"
    },
    create: {
      id: ids.foodCategory,
      userId: ids.ownerUser,
      scope: "personal",
      type: "expense",
      name: "Food"
    }
  });

  await prisma.category.upsert({
    where: { id: ids.fundCategory },
    update: {
      name: "Family Fund",
      type: "deposit",
      scope: "shared_fund"
    },
    create: {
      id: ids.fundCategory,
      familyId: ids.family,
      scope: "shared_fund",
      type: "deposit",
      name: "Family Fund"
    }
  });

  await prisma.personalTransaction.upsert({
    where: { id: ids.breakfastTransaction },
    update: {
      note: "Breakfast",
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
      note: "Breakfast",
      occurredAt: timestamp
    }
  });

  await prisma.budget.upsert({
    where: { id: ids.foodBudget },
    update: {
      name: "Monthly Food Budget",
      amount: 3000,
      periodType: "monthly",
      startAt: new Date("2026-05-01T00:00:00.000Z"),
      endAt: new Date("2026-05-31T23:59:59.999Z")
    },
    create: {
      id: ids.foodBudget,
      familyId: ids.family,
      userId: ids.ownerUser,
      name: "Monthly Food Budget",
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
      name: "Daily Family Fund",
      balance: 42000,
      permissions: {}
    },
    create: {
      id: ids.dailyFund,
      familyId: ids.family,
      name: "Daily Family Fund",
      balance: 42000,
      permissions: {},
      createdBy: ids.ownerUser
    }
  });

  await prisma.fundTransaction.upsert({
    where: { id: ids.fundDeposit },
    update: {
      amount: 42000,
      note: "Initial fund",
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
      note: "Initial fund",
      occurredAt: timestamp
    }
  });

  await prisma.task.upsert({
    where: { id: ids.autoTask },
    update: {
      title: "Take out trash",
      description: "Daily chore",
      maxPoints: 10,
      approvalMode: TaskApprovalMode.AUTO
    },
    create: {
      id: ids.autoTask,
      familyId: ids.family,
      title: "Take out trash",
      description: "Daily chore",
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
      description: "Dad's wish",
      status: WishStatus.ACTIVE,
      agreedPoints: 50000
    },
    create: {
      id: ids.wish5090,
      familyId: ids.family,
      requesterId: ids.ownerUser,
      fulfillerId: ids.ownerUser,
      title: "RTX 5090",
      description: "Dad's wish",
      status: WishStatus.ACTIVE,
      agreedPoints: 50000
    }
  });

  await prisma.notification.upsert({
    where: { id: ids.welcomeNotification },
    update: {
      title: "Welcome to Family OS",
      body: "The MVP notification center is connected to backend data."
    },
    create: {
      id: ids.welcomeNotification,
      userId: ids.ownerUser,
      familyId: ids.family,
      type: "points_changed",
      title: "Welcome to Family OS",
      body: "The MVP notification center is connected to backend data."
    }
  });

  console.log("Seeded Family OS MVP database fixture.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
