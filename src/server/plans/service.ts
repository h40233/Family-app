import type { FamilyPlan } from "@/server/families";
import {
  getBillingProvider,
  type BillingWebhookEvent,
  type BillingWebhookEventRecord
} from "@/server/billing";
import { PlanType } from "@prisma/client";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { getMemoryStore, nowIso } from "@/server/store";
import type {
  CheckoutSession,
  FamilyPlanStatus,
  PlanLimits,
  PlanLimitStatus
} from "./types";

export class PlanLimitError extends Error {
  constructor(message = "This feature requires a paid plan.") {
    super(message);
    this.name = "PlanLimitError";
  }
}

export const planLimits: Record<FamilyPlan, PlanLimits> = {
  free: {
    plan: "free",
    maxMembers: 5,
    maxTasks: 30,
    maxWishes: 10,
    reportsMonths: 3,
    canExportReports: false,
    canUseAdvancedReports: false,
    canUseMultipleThemes: false,
    hasAds: true
  },
  paid: {
    plan: "paid",
    maxMembers: null,
    maxTasks: null,
    maxWishes: null,
    reportsMonths: null,
    canExportReports: true,
    canUseAdvancedReports: true,
    canUseMultipleThemes: true,
    hasAds: false
  }
};

export async function getFamilyPlanStatus(familyId: string): Promise<FamilyPlanStatus> {
  if (usesDatabaseRuntime("plans")) {
    return getDatabaseFamilyPlanStatus(familyId);
  }

  const store = getMemoryStore();
  const family = store.families.find((item) => item.id === familyId);

  if (!family) {
    throw new Error("Family not found.");
  }

  const limits = planLimits[family.plan];
  const usage = {
    members: store.familyMembers.filter((member) => member.familyId === familyId).length,
    tasks: store.tasks.filter((task) => task.familyId === familyId).length,
    wishes: store.wishes.filter((wish) => wish.familyId === familyId).length
  };

  return {
    familyId,
    plan: family.plan,
    limits,
    usage,
    statuses: {
      members: statusForUsage(usage.members, limits.maxMembers),
      tasks: statusForUsage(usage.tasks, limits.maxTasks),
      wishes: statusForUsage(usage.wishes, limits.maxWishes),
      reportExport: limits.canExportReports ? "ok" : "blocked"
    }
  };
}

export async function assertReportExportAllowed(familyId: string) {
  const status = await getFamilyPlanStatus(familyId);

  if (!status.limits.canExportReports) {
    throw new PlanLimitError("Report export is available on the paid plan.");
  }

  return status;
}

export async function createCheckoutSession(input: {
  familyId: string;
  userId: string;
}): Promise<CheckoutSession> {
  await assertCanManageBilling(input);

  const provider = getBillingProvider();
  const providerSession = await provider.createCheckoutSession({
    familyId: input.familyId,
    userId: input.userId,
    plan: "paid"
  });

  if (usesDatabaseRuntime("plans")) {
    await recordDatabaseCheckoutSession(providerSession);

    if (providerSession.status === "completed") {
      await updateFamilyPlan(input.familyId, "paid");
    }

    return providerSession;
  }

  if (providerSession.status === "completed") {
    await updateFamilyPlan(input.familyId, "paid");
  }

  getMemoryStore().checkoutSessions.push(providerSession);
  return providerSession;
}

export async function handleBillingWebhook(input: {
  rawBody: string;
  signature: string | null;
}): Promise<BillingWebhookEvent & { applied: boolean; duplicate?: boolean; providerEventId: string }> {
  const provider = getBillingProvider();
  const isValid = await provider.validateWebhookSignature(input);
  if (!isValid) {
    throw new Error("Invalid billing webhook signature.");
  }

  const event = await provider.parseWebhookEvent(input.rawBody);
  const providerEventId = event.providerEventId ?? deriveBillingProviderEventId(event);

  if (await hasProcessedBillingWebhookEvent(event.provider, providerEventId)) {
    return { ...event, providerEventId, applied: false, duplicate: true };
  }

  if (event.type === "checkout.completed" || event.type === "subscription.cancelled") {
    await updateFamilyPlan(event.familyId, event.plan);
  }

  await recordBillingWebhookEvent({
    id: `${event.provider}_${providerEventId}`,
    provider: event.provider,
    providerEventId,
    eventType: event.type,
    familyId: event.familyId,
    plan: event.plan,
    providerSessionId: event.providerSessionId,
    rawBody: input.rawBody,
    processedAt: nowIso()
  });

  return { ...event, providerEventId, applied: true };
}

export async function updateFamilyPlan(
  familyId: string,
  plan: FamilyPlan
): Promise<{ familyId: string; plan: FamilyPlan; updatedAt: string }> {
  if (usesDatabaseRuntime("plans")) {
    const family = await prisma.family.update({
      where: { id: familyId },
      data: { plan: toDatabasePlan(plan) }
    });

    return {
      familyId: family.id,
      plan: toFamilyPlan(family.plan),
      updatedAt: family.updatedAt.toISOString()
    };
  }

  const store = getMemoryStore();
  const family = store.families.find((item) => item.id === familyId);
  if (!family) throw new Error("Family not found.");

  family.plan = plan;
  family.updatedAt = nowIso();

  return {
    familyId,
    plan,
    updatedAt: family.updatedAt
  };
}

async function assertCanManageBilling(input: { familyId: string; userId: string }) {
  if (usesDatabaseRuntime("plans")) {
    const member = await prisma.familyMember.findFirst({
      where: {
        familyId: input.familyId,
        userId: input.userId,
        deletedAt: null
      }
    });

    if (!member) throw new Error("Family not found.");
    if (!["OWNER", "ADMIN"].includes(member.role)) {
      throw new Error("Only an owner or admin can upgrade the plan.");
    }

    return;
  }

  const store = getMemoryStore();
  const family = store.families.find((item) => item.id === input.familyId);
  const member = store.familyMembers.find(
    (item) => item.familyId === input.familyId && item.userId === input.userId
  );

  if (!family || !member) {
    throw new Error("Family not found.");
  }

  if (!["owner", "admin"].includes(member.role)) {
    throw new Error("Only an owner or admin can upgrade the plan.");
  }
}

async function getDatabaseFamilyPlanStatus(familyId: string): Promise<FamilyPlanStatus> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      _count: {
        select: {
          members: { where: { deletedAt: null } },
          tasks: { where: { deletedAt: null } },
          wishes: { where: { deletedAt: null } }
        }
      }
    }
  });

  if (!family) {
    throw new Error("Family not found.");
  }

  const plan = toFamilyPlan(family.plan);
  const limits = planLimits[plan];
  const usage = {
    members: family._count.members,
    tasks: family._count.tasks,
    wishes: family._count.wishes
  };

  return {
    familyId,
    plan,
    limits,
    usage,
    statuses: {
      members: statusForUsage(usage.members, limits.maxMembers),
      tasks: statusForUsage(usage.tasks, limits.maxTasks),
      wishes: statusForUsage(usage.wishes, limits.maxWishes),
      reportExport: limits.canExportReports ? "ok" : "blocked"
    }
  };
}

function statusForUsage(value: number, limit: number | null): PlanLimitStatus {
  if (limit === null) return "ok";
  if (value >= limit) return "blocked";
  if (value >= Math.ceil(limit * 0.8)) return "warning";
  return "ok";
}

async function hasProcessedBillingWebhookEvent(provider: string, providerEventId: string) {
  if (usesDatabaseRuntime("plans")) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM billing_webhook_events
      WHERE provider = ${provider} AND provider_event_id = ${providerEventId}
      LIMIT 1
    `;

    return rows.length > 0;
  }

  return getMemoryStore().billingWebhookEvents.some(
    (event) => event.provider === provider && event.providerEventId === providerEventId
  );
}

async function recordBillingWebhookEvent(event: BillingWebhookEventRecord) {
  if (usesDatabaseRuntime("plans")) {
    await prisma.$executeRaw`
      INSERT INTO billing_webhook_events (
        provider,
        provider_event_id,
        event_type,
        family_id,
        provider_session_id,
        plan,
        raw_body,
        processed_at
      )
      VALUES (
        ${event.provider},
        ${event.providerEventId},
        ${event.eventType},
        ${event.familyId}::uuid,
        ${event.providerSessionId ?? null},
        ${event.plan},
        ${event.rawBody},
        ${new Date(event.processedAt)}
      )
    `;
    return;
  }

  getMemoryStore().billingWebhookEvents.push(event);
}

async function recordDatabaseCheckoutSession(session: CheckoutSession) {
  await prisma.$executeRaw`
    INSERT INTO billing_checkout_sessions (
      family_id,
      provider,
      provider_session_id,
      plan,
      status,
      checkout_url,
      created_at
    )
    VALUES (
      ${session.familyId}::uuid,
      ${session.provider},
      ${session.providerSessionId ?? null},
      ${session.plan}::plan_type,
      ${session.status},
      ${session.checkoutUrl},
      ${new Date(session.createdAt)}
    )
    ON CONFLICT (provider, provider_session_id)
    DO UPDATE SET
      family_id = EXCLUDED.family_id,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      checkout_url = EXCLUDED.checkout_url
  `;
}

function deriveBillingProviderEventId(event: BillingWebhookEvent) {
  return [
    event.provider,
    event.type,
    event.providerSessionId ?? event.familyId,
    event.plan
  ].join(":");
}

function toFamilyPlan(plan: PlanType): FamilyPlan {
  return plan === PlanType.PAID ? "paid" : "free";
}

function toDatabasePlan(plan: FamilyPlan) {
  return plan === "paid" ? PlanType.PAID : PlanType.FREE;
}
