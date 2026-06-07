import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/server/auth";
import { devFixtureIds } from "@/server/dev-fixtures";
import { getMemoryStore, resetMemoryStore } from "@/server/store";
import { createFamily, joinFamily, listFamiliesForUser } from "./service";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Second Parent",
  email: "second-parent@example.test",
  isChildAccount: false
};

describe("families service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("creates a family and adds the creator as owner", async () => {
    const family = await createFamily(user, { name: "Second Family" });
    const families = await listFamiliesForUser(user);
    const ownerMember = getMemoryStore().familyMembers.find(
      (member) => member.familyId === family.id && member.userId === user.id
    );

    expect(family).toMatchObject({
      name: "Second Family",
      ownerUserId: user.id
    });
    expect(ownerMember).toMatchObject({
      role: "owner",
      displayName: user.displayName
    });
    expect(families.some((item) => item.id === family.id)).toBe(true);
  });

  it("joins an existing family by family code", async () => {
    const member = await joinFamily(user, { familyCode: devFixtureIds.family });
    const families = await listFamiliesForUser(user);

    expect(member).toMatchObject({
      familyId: devFixtureIds.family,
      userId: user.id,
      role: "member",
      family: {
        id: devFixtureIds.family,
        name: "Development Family"
      }
    });
    expect(families.some((family) => family.id === devFixtureIds.family)).toBe(true);
  });

  it("does not create duplicate memberships when joining twice", async () => {
    const firstJoin = await joinFamily(user, { familyCode: devFixtureIds.family });
    const secondJoin = await joinFamily(user, { familyCode: devFixtureIds.family });
    const memberships = getMemoryStore().familyMembers.filter(
      (member) => member.familyId === devFixtureIds.family && member.userId === user.id
    );

    expect(secondJoin.id).toBe(firstJoin.id);
    expect(memberships).toHaveLength(1);
  });
});
