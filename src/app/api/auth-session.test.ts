import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthSessionStore } from "@/server/auth";
import { resetMemoryStore } from "@/server/store";
import { POST as childLoginRoute } from "./v1/auth/child-login/route";
import { POST as loginRoute } from "./v1/auth/login/route";
import { POST as logoutRoute } from "./v1/auth/logout/route";
import { GET as meRoute } from "./v1/auth/me/route";
import { POST as registerRoute } from "./v1/auth/register/route";

function jsonRequest(path: string, body: Record<string, unknown>, cookie?: string) {
  return new Request(`http://localhost/api/v1${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

function getRequest(path: string, cookie?: string) {
  return new Request(`http://localhost/api/v1${path}`, {
    headers: cookie ? { cookie } : {}
  });
}

function sessionCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toContain("family_os_session=");
  return setCookie?.split(";")[0] ?? "";
}

describe("auth cookie session routes", () => {
  beforeEach(() => {
    resetMemoryStore();
    resetAuthSessionStore();
  });

  it("registers a user, sets a session cookie, and resolves /me from the cookie", async () => {
    const registerResponse = await registerRoute(
      jsonRequest("/auth/register", {
        displayName: "Mom",
        email: "mom@example.test",
        password: "pass1234"
      })
    );

    expect(registerResponse.status).toBe(201);
    const cookie = sessionCookie(registerResponse);

    const meResponse = await meRoute(getRequest("/auth/me", cookie));

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      data: {
        user: {
          displayName: "Mom",
          email: "mom@example.test",
          isChildAccount: false
        }
      }
    });
  });

  it("rejects registration passwords shorter than eight characters", async () => {
    const registerResponse = await registerRoute(
      jsonRequest("/auth/register", {
        displayName: "Short Password User",
        email: "short-password@example.test",
        password: "short"
      })
    );

    expect(registerResponse.status).toBe(400);
    expect(registerResponse.headers.get("set-cookie") ?? "").not.toContain("family_os_session=");
  });

  it("logs in with a cookie-backed session and logs out by clearing it", async () => {
    const loginResponse = await loginRoute(
      jsonRequest("/auth/login", {
        email: "dev@family-os.local",
        password: "pass1234"
      })
    );

    expect(loginResponse.status).toBe(201);
    const cookie = sessionCookie(loginResponse);

    const logoutResponse = await logoutRoute(jsonRequest("/auth/logout", {}, cookie));

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("creates a child session from the family code and child username", async () => {
    const response = await childLoginRoute(
      jsonRequest("/auth/child-login", {
        familyCode: "00000000-0000-4000-8000-000000001001",
        username: "Development Child",
        pin: "1234"
      })
    );

    expect(response.status).toBe(201);
    const cookie = sessionCookie(response);
    const meResponse = await meRoute(getRequest("/auth/me", cookie));

    await expect(meResponse.json()).resolves.toMatchObject({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000002",
          isChildAccount: true
        }
      }
    });
  });

  it("rejects development auth headers in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      const response = await meRoute(
        new Request("http://localhost/api/v1/auth/me", {
          headers: {
            "x-family-os-user-id": "00000000-0000-4000-8000-000000000001",
            "x-family-os-user-name": "Development User"
          }
        })
      );

      expect(response.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not create memory login sessions in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FAMILY_OS_DATA_SOURCE", "memory");
    vi.stubEnv("FAMILY_OS_AUTH_DATA_SOURCE", "memory");

    try {
      const response = await loginRoute(
        jsonRequest("/auth/login", {
          email: "dev@family-os.local",
          password: "pass1234"
        })
      );

      expect(response.status).not.toBe(201);
      expect(response.headers.get("set-cookie") ?? "").not.toContain("family_os_session=");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
