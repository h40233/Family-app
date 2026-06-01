import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import {
  createFundTransaction,
  createSharedFund,
  listFundTransactions,
  listSharedFunds
} from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("shared fund service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("creates funds and records deposit and expense transactions", async () => {
    const fund = await createSharedFund({
      familyId,
      actorUserId,
      name: "?…é??ºé?"
    });

    await createFundTransaction({
      familyId,
      fundId: fund.id,
      actorUserId,
      type: "deposit",
      amount: 1000,
      note: "?¸çˆ¸å­˜å…¥"
    });
    await createFundTransaction({
      familyId,
      fundId: fund.id,
      actorUserId,
      type: "expense",
      amount: 300,
      note: "è»Šç¥¨"
    });

    const funds = await listSharedFunds(familyId);
    const updatedFund = funds.find((item) => item.id === fund.id);
    const transactions = await listFundTransactions({ familyId, fundId: fund.id });

    expect(updatedFund?.balance).toBe(700);
    expect(transactions).toHaveLength(2);
  });
});
