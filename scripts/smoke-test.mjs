const baseUrl = process.env.FAMILY_OS_BASE_URL ?? "http://localhost:3000";

const childHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": "00000000-0000-4000-8000-000000000002",
  "x-family-os-user-name": "Development Child",
  "x-family-os-child": "true"
};

let sessionCookie = "";

const checks = [
  {
    name: "login creates session cookie",
    request: [
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "dev@family-os.local",
          password: "pass1234"
        })
      }
    ],
    expectStatus: 201,
    expectText: "dev@family-os.local",
    captureCookie: true
  },
  {
    name: "me API reads session cookie",
    request: ["/api/v1/auth/me"],
    expectStatus: 200,
    expectText: "dev@family-os.local",
    useSessionCookie: true
  },
  {
    name: "health API",
    request: ["/api/v1/health"],
    expectStatus: 200
  },
  {
    name: "manifest",
    request: ["/manifest.webmanifest"],
    expectStatus: 200,
    expectText: '"display":"standalone"'
  },
  {
    name: "service worker",
    request: ["/sw.js"],
    expectStatus: 200,
    expectText: "family-os-shell-v1"
  },
  {
    name: "dashboard page",
    request: ["/"],
    expectStatus: 200,
    expectText: "Family OS"
  },
  {
    name: "personal money page",
    request: ["/money/personal"],
    expectStatus: 200
  },
  {
    name: "shared funds page",
    request: ["/money/shared-funds"],
    expectStatus: 200
  },
  {
    name: "tasks page",
    request: ["/tasks"],
    expectStatus: 200
  },
  {
    name: "points page",
    request: ["/points"],
    expectStatus: 200
  },
  {
    name: "wishes page",
    request: ["/wishes"],
    expectStatus: 200
  },
  {
    name: "reports page",
    request: ["/reports"],
    expectStatus: 200
  },
  {
    name: "billing page",
    request: ["/billing"],
    expectStatus: 200
  },
  {
    name: "plan limits",
    request: ["/api/v1/families/00000000-0000-4000-8000-000000001001/plan/limits"],
    expectStatus: 200,
    useSessionCookie: true
  },
  {
    name: "report export respects current plan",
    request: ["/api/v1/families/00000000-0000-4000-8000-000000001001/reports/export?format=csv"],
    expectStatuses: [200, 402],
    useSessionCookie: true
  },
  {
    name: "checkout upgrades to paid",
    request: [
      "/api/v1/families/00000000-0000-4000-8000-000000001001/billing/checkout",
      { method: "POST" }
    ],
    expectStatus: 201,
    expectText: '"plan":"paid"',
    useSessionCookie: true
  },
  {
    name: "paid plan unlocks Excel export",
    request: ["/api/v1/families/00000000-0000-4000-8000-000000001001/reports/export?format=xls"],
    expectStatus: 200,
    expectText: "Excel.Sheet",
    useSessionCookie: true
  },
  {
    name: "budgets list",
    request: ["/api/v1/families/00000000-0000-4000-8000-000000001001/budgets"],
    expectStatus: 200,
    expectText: "Monthly Food Budget",
    useSessionCookie: true
  },
  {
    name: "create push subscription",
    request: [
      "/api/v1/push/subscriptions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://push.example.test/smoke",
          keys: {
            p256dh: "smoke-public-key",
            auth: "smoke-auth-secret"
          }
        })
      }
    ],
    expectStatus: 201,
    expectText: "push.example.test",
    useSessionCookie: true
  },
  {
    name: "list push subscriptions",
    request: ["/api/v1/push/subscriptions"],
    expectStatus: 200,
    expectText: "push.example.test",
    useSessionCookie: true
  },
  {
    name: "child can list wishes",
    request: ["/api/v1/families/00000000-0000-4000-8000-000000001001/wishes", { headers: childHeaders }],
    expectStatus: 200
  },
  {
    name: "child cannot review tasks",
    request: [
      "/api/v1/families/00000000-0000-4000-8000-000000001001/tasks/00000000-0000-4000-8000-000000004001/review",
      {
        method: "POST",
        headers: childHeaders,
        body: JSON.stringify({
          completionId: "missing",
          approved: true,
          points: 1
        })
      }
    ],
    expectStatus: 403
  },
  {
    name: "child cannot delete wishes",
    request: [
      "/api/v1/families/00000000-0000-4000-8000-000000001001/wishes/00000000-0000-4000-8000-000000005001",
      {
        method: "DELETE",
        headers: childHeaders
      }
    ],
    expectStatus: 403
  }
];

async function runCheck(check) {
  const [path, rawInit] = check.request;
  const init = withSessionCookie(rawInit ?? {}, check.useSessionCookie);
  const response = await fetch(new URL(path, baseUrl), init);
  const text = await response.text();

  const expectedStatuses = check.expectStatuses ?? [check.expectStatus];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${check.name}: expected ${expectedStatuses.join(" or ")}, got ${response.status}`
    );
  }

  if (check.expectText && !normalize(text).includes(normalize(check.expectText))) {
    throw new Error(`${check.name}: expected response to include ${check.expectText}`);
  }

  if (check.captureCookie) {
    const setCookie = response.headers.get("set-cookie");
    const cookie = setCookie?.split(";")[0] ?? "";
    if (!cookie.startsWith("family_os_session=")) {
      throw new Error(`${check.name}: response did not include a session cookie`);
    }
    sessionCookie = cookie;
  }

  console.log(`ok - ${check.name}`);
}

function withSessionCookie(init, enabled) {
  if (!enabled) return init;
  if (!sessionCookie) {
    throw new Error("Session cookie was requested before login completed");
  }

  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      cookie: sessionCookie
    }
  };
}

function normalize(value) {
  return value.replace(/\s+/g, "");
}

for (const check of checks) {
  await runCheck(check);
}
