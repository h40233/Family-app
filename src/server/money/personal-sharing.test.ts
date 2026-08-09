import { beforeEach, describe, expect, it } from "vitest";
import { devFixtureIds } from "@/server/dev-fixtures";
import { resetMemoryStore } from "@/server/store";
import {
  listFamilyPersonalSharing,
  updatePersonalSharingSetting
} from "./service";

const ownerUserId = devFixtureIds.ownerUser;
const childUserId = devFixtureIds.childUser;
const familyId = devFixtureIds.family;

describe("personal accounting sharing levels", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("hides personal money data when sharing is disabled", async () => {
    await updatePersonalSharingSetting({
      userId: ownerUserId,
      familyId,
      sharingLevel: "none"
    });

    const [ownerSharing] = await listFamilyPersonalSharing({
      viewerUserId: childUserId,
      familyId
    });

    expect(ownerSharing).toMatchObject({
      userId: ownerUserId,
      sharingLevel: "none"
    });
    expect(ownerSharing.totalBalance).toBeUndefined();
    expect(ownerSharing.accounts).toBeUndefined();
    expect(ownerSharing.categorySummaries).toBeUndefined();
    expect(ownerSharing.transactions).toBeUndefined();
  });

  it("reveals only total balance at balance-only level", async () => {
    await updatePersonalSharingSetting({
      userId: ownerUserId,
      familyId,
      sharingLevel: "balance_only"
    });

    const [ownerSharing] = await listFamilyPersonalSharing({
      viewerUserId: childUserId,
      familyId
    });

    expect(ownerSharing.totalBalance).toBe(51000);
    expect(ownerSharing.accounts).toBeUndefined();
    expect(ownerSharing.categorySummaries).toBeUndefined();
    expect(ownerSharing.transactions).toBeUndefined();
  });

  it("reveals category totals without transaction rows at category-summary level", async () => {
    await updatePersonalSharingSetting({
      userId: ownerUserId,
      familyId,
      sharingLevel: "category_summary"
    });

    const [ownerSharing] = await listFamilyPersonalSharing({
      viewerUserId: childUserId,
      familyId
    });

    expect(ownerSharing.totalBalance).toBe(51000);
    expect(ownerSharing.categorySummaries).toEqual([
      {
        category: expect.any(String),
        income: 0,
        expense: 80,
        transactionCount: 1
      }
    ]);
    expect(ownerSharing.accounts).toBeUndefined();
    expect(ownerSharing.transactions).toBeUndefined();
  });

  it("reveals limited transaction rows without notes at partial-transaction level", async () => {
    await updatePersonalSharingSetting({
      userId: ownerUserId,
      familyId,
      sharingLevel: "partial_transactions",
      config: { transactionLimit: 1 }
    });

    const [ownerSharing] = await listFamilyPersonalSharing({
      viewerUserId: childUserId,
      familyId
    });

    expect(ownerSharing.totalBalance).toBe(51000);
    expect(ownerSharing.transactions).toHaveLength(1);
    expect(ownerSharing.transactions?.[0]).toMatchObject({
      type: "expense",
      amount: 80
    });
    expect(ownerSharing.transactions?.[0].note).toBeUndefined();
    expect(ownerSharing.accounts).toBeUndefined();
  });

  it("reveals account balances and full transaction rows at full level", async () => {
    await updatePersonalSharingSetting({
      userId: ownerUserId,
      familyId,
      sharingLevel: "full"
    });

    const [ownerSharing] = await listFamilyPersonalSharing({
      viewerUserId: childUserId,
      familyId
    });

    expect(ownerSharing.totalBalance).toBe(51000);
    expect(ownerSharing.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: devFixtureIds.cashAccount,
          balance: 1000
        }),
        expect.objectContaining({
          id: devFixtureIds.bankAccount,
          balance: 50000
        })
      ])
    );
    expect(ownerSharing.transactions?.[0]).toMatchObject({
      note: "Breakfast",
      accountId: devFixtureIds.cashAccount,
      accountName: "Cash"
    });
  });
});
