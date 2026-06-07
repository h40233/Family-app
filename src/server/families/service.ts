import type { AuthUser } from "@/server/auth";
import { hashPassword } from "@/server/auth/session";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import type {
  CreateChildAccountInput,
  CreateFamilyInput,
  Family,
  FamilyMember,
  InviteFamilyMemberInput,
  JoinFamilyInput,
  UpdateFamilyInput,
  UpdateFamilyMemberInput
} from "./types";

export async function listFamiliesForUser(user: AuthUser): Promise<Family[]> {
  if (usesDatabaseRuntime("families")) {
    const memberships = await prisma.familyMember.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        family: { deletedAt: null }
      },
      include: { family: true },
      orderBy: { joinedAt: "asc" }
    });

    return memberships.map((member) => toFamily(member.family));
  }

  const store = getMemoryStore();
  const familyIds = new Set(
    store.familyMembers
      .filter((member) => member.userId === user.id)
      .map((member) => member.familyId)
  );

  return store.families.filter((family) => familyIds.has(family.id));
}

export async function createFamily(
  user: AuthUser,
  input: CreateFamilyInput
): Promise<Family & { ownerUserId: string }> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error("Family name is required.");
  }

  if (usesDatabaseRuntime("families")) {
    const family = await prisma.family.create({
      data: {
        name,
        ownerUserId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            permissions: {}
          }
        }
      }
    });

    return { ...toFamily(family), ownerUserId: family.ownerUserId };
  }

  const store = getMemoryStore();
  const createdAt = nowIso();
  const family: Family & { ownerUserId: string } = {
    id: createId("family"),
    name,
    plan: "free",
    ownerUserId: user.id,
    createdAt,
    updatedAt: createdAt
  };

  store.families.push(family);
  store.familyMembers.push({
    id: createId("member"),
    familyId: family.id,
    userId: user.id,
    displayName: user.displayName,
    role: "owner",
    isChildAccount: user.isChildAccount
  });

  return family;
}

export async function joinFamily(
  user: AuthUser,
  input: JoinFamilyInput
): Promise<FamilyMember & { family: Family }> {
  const familyId = input.familyCode?.trim();
  if (!familyId) {
    throw new Error("Family code is required.");
  }

  if (usesDatabaseRuntime("families")) {
    const role = user.isChildAccount ? "CHILD" : "MEMBER";
    const family = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null }
    });

    if (!family) {
      throw new Error("Family not found.");
    }

    const activeMember = await prisma.familyMember.findFirst({
      where: { familyId, userId: user.id, deletedAt: null },
      include: { family: true, user: true }
    });

    if (activeMember) {
      return {
        ...toFamilyMember(activeMember),
        family: toFamily(activeMember.family)
      };
    }

    const deletedMember = await prisma.familyMember.findFirst({
      where: { familyId, userId: user.id, deletedAt: { not: null } },
      include: { family: true, user: true }
    });

    if (deletedMember) {
      const restoredMember = await prisma.familyMember.update({
        where: { id: deletedMember.id },
        data: {
          deletedAt: null,
          role,
          permissions: {}
        },
        include: { family: true, user: true }
      });

      return {
        ...toFamilyMember(restoredMember),
        family: toFamily(restoredMember.family)
      };
    }

    const member = await prisma.familyMember.create({
      data: {
        familyId,
        userId: user.id,
        role,
        permissions: {}
      },
      include: { family: true, user: true }
    });

    return {
      ...toFamilyMember(member),
      family: toFamily(member.family)
    };
  }

  const store = getMemoryStore();
  const family = store.families.find((item) => item.id === familyId);
  if (!family) {
    throw new Error("Family not found.");
  }

  const existingMember = store.familyMembers.find(
    (member) => member.familyId === familyId && member.userId === user.id
  );

  if (existingMember) {
    return { ...existingMember, family };
  }

  const member: FamilyMember = {
    id: createId("member"),
    familyId,
    userId: user.id,
    displayName: user.displayName,
    role: user.isChildAccount ? "child" : "member",
    isChildAccount: user.isChildAccount
  };

  store.familyMembers.push(member);

  return { ...member, family };
}

export async function getFamily(
  user: AuthUser,
  familyId: string
): Promise<Family> {
  if (usesDatabaseRuntime("families")) {
    const member = await prisma.familyMember.findFirst({
      where: {
        familyId,
        userId: user.id,
        deletedAt: null,
        family: { deletedAt: null }
      },
      include: { family: true }
    });

    if (!member) {
      throw new Error("Family not found.");
    }

    return toFamily(member.family);
  }

  const store = getMemoryStore();
  const member = store.familyMembers.find(
    (item) => item.familyId === familyId && item.userId === user.id
  );
  const family = store.families.find((item) => item.id === familyId);

  if (!member || !family) {
    throw new Error("Family not found.");
  }

  return family;
}

export async function updateFamily(
  user: AuthUser,
  familyId: string,
  input: UpdateFamilyInput
): Promise<Family & { updatedByUserId: string }> {
  if (usesDatabaseRuntime("families")) {
    await getFamily(user, familyId);
    const family = await prisma.family.update({
      where: { id: familyId },
      data: { name: input.name }
    });

    return { ...toFamily(family), updatedByUserId: user.id };
  }

  const family = await getFamily(user, familyId);
  family.name = input.name ?? family.name;
  family.updatedAt = nowIso();

  return { ...family, updatedByUserId: user.id };
}

export async function listFamilyMembers(
  user: AuthUser,
  familyId: string
): Promise<FamilyMember[]> {
  await getFamily(user, familyId);

  if (usesDatabaseRuntime("families")) {
    const members = await prisma.familyMember.findMany({
      where: { familyId, deletedAt: null },
      include: { user: true },
      orderBy: { joinedAt: "asc" }
    });

    return members.map(toFamilyMember);
  }

  return getMemoryStore().familyMembers.filter((member) => member.familyId === familyId);
}

export async function inviteFamilyMember(
  user: AuthUser,
  familyId: string,
  input: InviteFamilyMemberInput
): Promise<{
  familyId: string;
  invitedByUserId: string;
  email: string;
  role: string;
}> {
  await getFamily(user, familyId);

  return {
    familyId,
    invitedByUserId: user.id,
    email: input.email,
    role: input.role
  };
}

export async function createChildAccount(
  user: AuthUser,
  familyId: string,
  input: CreateChildAccountInput
): Promise<FamilyMember & { username: string; createdByUserId: string }> {
  await getFamily(user, familyId);

  if (usesDatabaseRuntime("families")) {
    const childUser = await prisma.user.create({
      data: {
        name: input.displayName,
        email: null,
        passwordHash: hashPassword(input.pin),
        isChildAccount: true,
        parentUserId: user.id
      }
    });
    const member = await prisma.familyMember.create({
      data: {
        familyId,
        userId: childUser.id,
        role: "CHILD",
        permissions: {}
      },
      include: { user: true }
    });

    return {
      ...toFamilyMember(member),
      username: input.username,
      createdByUserId: user.id
    };
  }

  const member: FamilyMember & { username: string; createdByUserId: string } = {
    id: createId("member"),
    familyId,
    userId: createId("child_user"),
    displayName: input.displayName,
    username: input.username,
    role: "child",
    isChildAccount: true,
    createdByUserId: user.id
  };

  getMemoryStore().familyMembers.push(member);

  return member;
}

export async function updateFamilyMember(
  user: AuthUser,
  familyId: string,
  memberId: string,
  input: UpdateFamilyMemberInput
): Promise<FamilyMember & { updatedByUserId: string }> {
  await getFamily(user, familyId);

  if (usesDatabaseRuntime("families")) {
    const member = await prisma.familyMember.findFirst({
      where: { familyId, id: memberId, deletedAt: null },
      include: { user: true }
    });

    if (!member) {
      throw new Error("Family member not found.");
    }

    if (input.displayName) {
      await prisma.user.update({
        where: { id: member.userId },
        data: { name: input.displayName }
      });
    }

    const updated = await prisma.familyMember.update({
      where: { id: memberId },
      data: { role: input.role ? toPrismaRole(input.role) : undefined },
      include: { user: true }
    });

    return { ...toFamilyMember(updated), updatedByUserId: user.id };
  }

  const member = getMemoryStore().familyMembers.find(
    (item) => item.familyId === familyId && item.id === memberId
  );

  if (!member) {
    throw new Error("Family member not found.");
  }

  member.displayName = input.displayName ?? member.displayName;
  member.role = input.role ?? member.role;

  return { ...member, updatedByUserId: user.id };
}

export async function removeFamilyMember(
  user: AuthUser,
  familyId: string,
  memberId: string
): Promise<{
  familyId: string;
  memberId: string;
  removedByUserId: string;
}> {
  await getFamily(user, familyId);

  if (usesDatabaseRuntime("families")) {
    await prisma.familyMember.updateMany({
      where: { familyId, id: memberId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    return {
      familyId,
      memberId,
      removedByUserId: user.id
    };
  }

  const store = getMemoryStore();
  store.familyMembers = store.familyMembers.filter(
    (member) => !(member.familyId === familyId && member.id === memberId)
  );

  return {
    familyId,
    memberId,
    removedByUserId: user.id
  };
}

function toFamily(family: {
  id: string;
  name: string;
  plan: "FREE" | "PAID";
  createdAt: Date;
  updatedAt: Date;
}): Family {
  return {
    id: family.id,
    name: family.name,
    plan: family.plan.toLowerCase() as Family["plan"],
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString()
  };
}

function toFamilyMember(member: {
  id: string;
  familyId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "CHILD" | "VIEWER";
  user: {
    name: string;
    isChildAccount: boolean;
  };
}): FamilyMember {
  return {
    id: member.id,
    familyId: member.familyId,
    userId: member.userId,
    displayName: member.user.name,
    role: member.role.toLowerCase() as FamilyMember["role"],
    isChildAccount: member.user.isChildAccount
  };
}

function toPrismaRole(role: FamilyMember["role"]) {
  return role.toUpperCase() as "OWNER" | "ADMIN" | "MEMBER" | "CHILD" | "VIEWER";
}
