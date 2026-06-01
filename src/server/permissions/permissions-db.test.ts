import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPermission,
  getEffectivePermissions,
  updateResourcePermissionOverrides,
  updateRolePermissions
} from "./service";

const prismaMock = vi.hoisted(() => ({
  familyMember: {
    findFirst: vi.fn()
  },
  familyRolePermission: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  resourcePermission: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn()
  },
  $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations))
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: prismaMock
}));

const familyId = "00000000-0000-4000-8000-000000001001";
const childUserId = "00000000-0000-4000-8000-000000000002";
const fundId = "00000000-0000-4000-8000-000000003001";

describe("permission service database runtime", () => {
  beforeEach(() => {
    process.env.FAMILY_OS_PERMISSIONS_DATA_SOURCE = "database";
    vi.clearAllMocks();
    prismaMock.familyMember.findFirst.mockResolvedValue({
      role: "CHILD",
      permissions: {
        allow: ["shared_fund:manage_fund"],
        deny: ["wish:create"]
      }
    });
    prismaMock.familyRolePermission.findUnique.mockResolvedValue(null);
    prismaMock.resourcePermission.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.FAMILY_OS_PERMISSIONS_DATA_SOURCE;
  });

  it("combines role defaults with member custom permission overrides", async () => {
    const result = await getEffectivePermissions(childUserId, familyId);

    expect(result.role).toBe("child");
    expect(result.permissions).toContain("shared_fund:manage_fund");
    expect(result.permissions).not.toContain("wish:create");
  });

  it("uses resource overrides loaded from the database", async () => {
    prismaMock.resourcePermission.findMany.mockResolvedValue([
      {
        familyId,
        resourceType: "shared_fund",
        resourceId: fundId,
        subjectType: "user",
        subjectId: childUserId,
        permissions: {
          allow: [],
          deny: ["manage_fund"]
        }
      }
    ]);

    const result = await checkPermission({
      userId: childUserId,
      familyId,
      resourceType: "shared_fund",
      resourceId: fundId,
      action: "manage_fund"
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Denied by resource override.");
  });

  it("persists family-scoped role permissions and resource overrides", async () => {
    await updateRolePermissions("viewer", ["family:view", "report:view"], familyId);
    await updateResourcePermissionOverrides(familyId, "shared_fund", fundId, [
      {
        familyId,
        resourceType: "shared_fund",
        resourceId: fundId,
        subjectRole: "viewer",
        allow: ["view"],
        deny: ["manage_fund"]
      }
    ]);

    expect(prismaMock.familyRolePermission.upsert).toHaveBeenCalledWith({
      where: { familyId_role: { familyId, role: "VIEWER" } },
      update: { permissions: ["family:view", "report:view"] },
      create: {
        familyId,
        role: "VIEWER",
        permissions: ["family:view", "report:view"]
      }
    });
    expect(prismaMock.resourcePermission.deleteMany).toHaveBeenCalledWith({
      where: { familyId, resourceType: "shared_fund", resourceId: fundId }
    });
    expect(prismaMock.resourcePermission.create).toHaveBeenCalledWith({
      data: {
        familyId,
        resourceType: "shared_fund",
        resourceId: fundId,
        subjectType: "role",
        subjectId: "viewer",
        permissions: {
          allow: ["view"],
          deny: ["manage_fund"]
        }
      }
    });
  });
});
