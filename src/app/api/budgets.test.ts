import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import {
  GET as listBudgetsRoute,
  POST as createBudgetRoute
} from "./v1/families/[familyId]/budgets/route";

const familyId = "00000000-0000-4000-8000-000000001001";
const ownerHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": "00000000-0000-4000-8000-000000000001",
  "x-family-os-user-name": "Development User"
};

function ownerRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    ...init,
    headers: {
      ...ownerHeaders,
      ...init.headers
    }
  });
}

function familyContext() {
  return {
    params: Promise.resolve({ familyId })
  };
}

describe("budget routes", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("lists budget usage for reports", async () => {
    const response = await listBudgetsRoute(
      ownerRequest(`/families/${familyId}/budgets`),
      familyContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          budget: { id: "00000000-0000-4000-8000-000000002301", name: "Monthly Food Budget" },
          spent: 80,
          remaining: 2920,
          exceeded: false
        }
      ]
    });
  });

  it("creates a category budget", async () => {
    const response = await createBudgetRoute(
      ownerRequest(`/families/${familyId}/budgets`, {
        method: "POST",
        body: JSON.stringify({
          name: "Transport Budget",
          category: "Transport",
          amount: 500,
          targetType: "personal_category",
          periodType: "monthly"
        })
      }),
      familyContext()
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        budget: {
          name: "Transport Budget",
          category: "Transport",
          amount: 500
        },
        spent: 0,
        remaining: 500,
        exceeded: false
      }
    });
  });
});
