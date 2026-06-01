import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import {
  assertPermission,
  checkPermission,
  updateResourcePermissionOverrides
} from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";

describe("permission service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("allows owner to manage shared funds and adjust points", async () => {
    await expect(
      assertPermission({
        userId: "00000000-0000-4000-8000-000000000001",
        familyId,
        resourceType: "shared_fund",
        action: "manage_fund"
      })
    ).resolves.toBeDefined();

    await expect(
      assertPermission({
        userId: "00000000-0000-4000-8000-000000000001",
        familyId,
        resourceType: "point_ledger",
        action: "adjust_points"
      })
    ).resolves.toBeDefined();
  });

  it("denies child from managing shared funds or adjusting points", async () => {
    await expect(
      assertPermission({
        userId: "00000000-0000-4000-8000-000000000002",
        familyId,
        resourceType: "shared_fund",
        action: "manage_fund"
      })
    ).rejects.toThrow("Permission is not included in role permissions.");

    await expect(
      assertPermission({
        userId: "00000000-0000-4000-8000-000000000002",
        familyId,
        resourceType: "point_ledger",
        action: "adjust_points"
      })
    ).rejects.toThrow("Permission is not included in role permissions.");
  });

  it("uses resource overrides to deny role permissions", async () => {
    await updateResourcePermissionOverrides(familyId, "shared_fund", "00000000-0000-4000-8000-000000003001", [
      {
        familyId,
        resourceType: "shared_fund",
        resourceId: "00000000-0000-4000-8000-000000003001",
        subjectRole: "owner",
        allow: [],
        deny: ["manage_fund"]
      }
    ]);

    const result = await checkPermission({
      userId: "00000000-0000-4000-8000-000000000001",
      familyId,
      resourceType: "shared_fund",
      resourceId: "00000000-0000-4000-8000-000000003001",
      action: "manage_fund"
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Denied by resource override.");
  });
});
