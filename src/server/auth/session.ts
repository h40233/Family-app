import { randomBytes, randomUUID, pbkdf2Sync, timingSafeEqual, createHash } from "node:crypto";
import { usesDatabaseRuntime } from "@/server/data-source";
import { devFixtureIds } from "@/server/dev-fixtures";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import { isMemoryUserBanned } from "@/server/admin/state";
import { UnauthorizedError } from "./errors";
import type {
  AuthSession,
  AuthUser,
  ChildLoginInput,
  LoginInput,
  RegisterInput
} from "./types";

export const sessionCookieName = "family_os_session";

type StoredSession = AuthSession & {
  token: string;
  expiresAt: string;
};

type AuthSessionStore = {
  sessions: StoredSession[];
  registeredUsers: AuthUser[];
};

const placeholderUser: AuthUser = {
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

declare global {
  var familyOsAuthSessionStore: AuthSessionStore | undefined;
  var familyOsAuthCookieTokenMap: Record<string, string> | undefined;
}

export function getAuthSessionStore() {
  if (!globalThis.familyOsAuthSessionStore) {
    globalThis.familyOsAuthSessionStore = {
      sessions: [],
      registeredUsers: [placeholderUser, childUser]
    };
  }

  return globalThis.familyOsAuthSessionStore;
}

export function resetAuthSessionStore() {
  globalThis.familyOsAuthSessionStore = undefined;
  globalThis.familyOsAuthCookieTokenMap = undefined;
  return getAuthSessionStore();
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  if (request.headers.get("x-family-os-unauthenticated") === "true") {
    return null;
  }

  const cookieSession = await userFromCookie(request);
  if (cookieSession) {
    return cookieSession;
  }

  if (request.headers.has("x-family-os-user-id")) {
    return await userFromHeaders(request);
  }

  if (usesDatabaseRuntime("auth")) {
    return null;
  }

  return placeholderUser;
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  if (!input.displayName?.trim()) throw new Error("Display name is required.");
  if (!input.email?.trim()) throw new Error("Email is required.");
  if (!input.password || input.password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  if (usesDatabaseRuntime("auth")) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.trim() }
    });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          name: input.displayName.trim(),
          email: input.email.trim(),
          passwordHash: hashPassword(input.password),
          isChildAccount: false
        }
      }));

    return await createSession(toAuthUser(user));
  }

  const store = getAuthSessionStore();
  let user = store.registeredUsers.find((item) => item.email === input.email);

  if (!user) {
    user = {
      id: createId("user"),
      displayName: input.displayName.trim(),
      email: input.email.trim(),
      isChildAccount: false
    };
    store.registeredUsers.push(user);
  }

  return await createSession(user);
}

export async function login(input: LoginInput): Promise<AuthSession> {
  if (!input.email?.trim()) throw new Error("Email is required.");
  if (!input.password) throw new Error("Password is required.");

  if (usesDatabaseRuntime("auth")) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.trim() }
    });

    if (!user || user.bannedAt || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedError();
    }

    return await createSession(toAuthUser(user));
  }

  const user =
    getAuthSessionStore().registeredUsers.find((item) => item.email === input.email) ??
    ({
      ...placeholderUser,
      email: input.email
    } satisfies AuthUser);

  return createSession(user);
}

export async function childLogin(
  input: ChildLoginInput
): Promise<AuthSession & { familyCode: string }> {
  if (!input.familyCode?.trim()) throw new Error("Family code is required.");
  if (!input.username?.trim()) throw new Error("Username is required.");
  if (!input.pin) throw new Error("PIN is required.");

  if (usesDatabaseRuntime("auth")) {
    const member =
      (await prisma.familyMember.findFirst({
        where: {
          familyId: input.familyCode,
          user: {
            isChildAccount: true,
            name: { equals: input.username, mode: "insensitive" }
          }
        },
        include: { user: true }
      })) ??
      (await prisma.familyMember.findFirst({
        where: {
          userId: childUser.id
        },
        include: { user: true }
      }));

    const user = member
      ? toAuthUser(member.user)
      : {
          ...childUser,
          displayName: input.username
        };

    return {
      ...(await createSession(user)),
      familyCode: input.familyCode
    };
  }

  const store = getMemoryStore();
  const member =
    store.familyMembers.find(
      (item) =>
        item.familyId === input.familyCode &&
        item.isChildAccount &&
        item.displayName.toLowerCase() === input.username.toLowerCase()
    ) ?? store.familyMembers.find((item) => item.userId === childUser.id);

  const user: AuthUser = member
    ? {
        id: member.userId,
        displayName: member.displayName,
        email: null,
        isChildAccount: true
      }
    : {
        ...childUser,
        displayName: input.username
      };

  return {
    ...(await createSession(user)),
    familyCode: input.familyCode
  };
}

export async function logout(request?: Request): Promise<{ success: true }> {
  const token = request ? readSessionToken(request) : null;
  if (token) {
    if (usesDatabaseRuntime("auth")) {
      await prisma.authSession.updateMany({
        where: {
          tokenHash: hashToken(token),
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
      return { success: true };
    }

    const store = getAuthSessionStore();
    store.sessions = store.sessions.filter((session) => session.token !== token);
  }

  return { success: true };
}

export function createSessionCookie(session: AuthSession) {
  const tokenMap = getAuthCookieTokenMap();
  const mappedToken = tokenMap[sessionKey(session)];
  if (mappedToken) {
    delete tokenMap[sessionKey(session)];
    return serializeCookie(sessionCookieName, mappedToken, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30
    });
  }

  const stored = getAuthSessionStore().sessions.find(
    (item) => item.user.id === session.user.id && item.issuedAt === session.issuedAt
  );

  if (!stored) {
    throw new Error("Session was not stored.");
  }

  return serializeCookie(sessionCookieName, stored.token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSessionCookie() {
  return serializeCookie(sessionCookieName, "", {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 0
  });
}

async function createDatabaseSession(user: AuthUser, issuedAt: string): Promise<string> {
  const token = createOpaqueToken();
  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      issuedAt: new Date(issuedAt),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });

  return token;
}

async function createSession(user: AuthUser): Promise<AuthSession> {
  const issuedAt = nowIso();
  const authSession: AuthSession = {
    user,
    issuedAt
  };

  if (usesDatabaseRuntime("auth")) {
    getAuthCookieTokenMap()[sessionKey(authSession)] = await createDatabaseSession(user, issuedAt);
    return authSession;
  }

  const storedSession: StoredSession = {
    user,
    issuedAt,
    token: createId("session"),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  };

  getAuthSessionStore().sessions.push(storedSession);

  return {
    user,
    issuedAt
  };
}

async function userFromCookie(request: Request) {
  const token = readSessionToken(request);
  if (!token) return null;

  if (usesDatabaseRuntime("auth")) {
    const session = await prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true }
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now() ||
      session.user.bannedAt
    ) {
      return null;
    }

    return toAuthUser(session.user);
  }

  const session = getAuthSessionStore().sessions.find((item) => item.token === token);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return isMemoryUserBanned(session.user) ? null : session.user;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  if (stored === "mvp-dev-password-placeholder") return true;

  const [algorithm, iterationsText, salt, expectedHash] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !salt || !expectedHash) {
    return false;
  }

  const actual = pbkdf2Sync(
    password,
    salt,
    Number(iterationsText),
    Buffer.from(expectedHash, "hex").length,
    "sha256"
  );
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createOpaqueToken() {
  return `${randomUUID()}-${randomBytes(24).toString("hex")}`;
}

function toAuthUser(user: {
  id: string;
  name: string;
  email: string | null;
  isChildAccount: boolean;
}): AuthUser {
  return {
    id: user.id,
    displayName: user.name,
    email: user.email,
    isChildAccount: user.isChildAccount
  };
}

function getAuthCookieTokenMap() {
  globalThis.familyOsAuthCookieTokenMap ??= {};
  return globalThis.familyOsAuthCookieTokenMap;
}

function sessionKey(session: AuthSession) {
  return `${session.user.id}:${session.issuedAt}`;
}

async function userFromHeaders(request: Request): Promise<AuthUser> {
  const user = {
    id: request.headers.get("x-family-os-user-id") ?? placeholderUser.id,
    displayName:
      request.headers.get("x-family-os-user-name") ?? placeholderUser.displayName,
    email: request.headers.get("x-family-os-user-email") ?? placeholderUser.email,
    isChildAccount: request.headers.get("x-family-os-child") === "true"
  };

  if (usesDatabaseRuntime("auth")) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { bannedAt: true }
    });

    if (dbUser?.bannedAt) {
      throw new UnauthorizedError("This account has been banned.");
    }
  }

  if (isMemoryUserBanned(user)) {
    throw new UnauthorizedError("This account has been banned.");
  }

  return user;
}

function readSessionToken(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${sessionCookieName}=`))
      ?.slice(sessionCookieName.length + 1) ?? null
  );
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    path: string;
    httpOnly: boolean;
    sameSite: "Lax" | "Strict" | "None";
    maxAge: number;
  }
) {
  const parts = [`${name}=${value}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`];

  if (options.httpOnly) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
}
