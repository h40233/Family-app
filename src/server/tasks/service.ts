import { createNotification } from "@/server/notifications";
import { addPointLedgerEntry } from "@/server/points";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import {
  TaskApprovalMode as PrismaTaskApprovalMode,
  TaskCompletionStatus as PrismaTaskCompletionStatus
} from "@prisma/client";
import type {
  CompleteTaskInput,
  CreateTaskInput,
  DeleteTaskInput,
  GetTaskInput,
  ListTasksInput,
  ReviewTaskInput,
  TaskCompletion,
  TaskSummary,
  UpdateTaskInput
} from "./types";

function assignmentMode(assigneeIds: string[] = []) {
  if (assigneeIds.length === 0) return "open";
  if (assigneeIds.length === 1) return "single";
  return "multiple";
}

export async function listTasks(input: ListTasksInput): Promise<TaskSummary[]> {
  if (usesDatabaseRuntime("tasks")) {
    const tasks = await prisma.task.findMany({
      where: {
        familyId: input.familyId,
        deletedAt: null,
        assignments: input.assigneeId ? { some: { userId: input.assigneeId } } : undefined
      },
      include: { assignments: true },
      orderBy: { createdAt: "desc" }
    });

    return tasks.map(toTaskSummary).filter((task) => !input.status || task.status === input.status);
  }

  return getMemoryStore().tasks.filter((task) => {
    if (task.familyId !== input.familyId) return false;
    if (input.status && task.status !== input.status) return false;
    if (input.assigneeId && !task.assigneeIds.includes(input.assigneeId)) return false;
    return true;
  });
}

export async function createTask(input: CreateTaskInput): Promise<TaskSummary> {
  if (usesDatabaseRuntime("tasks")) {
    const task = await prisma.task.create({
      data: {
        familyId: input.familyId,
        title: input.title,
        description: input.description ?? "",
        maxPoints: input.maxPoints,
        approvalMode:
          input.approvalMode === "auto"
            ? PrismaTaskApprovalMode.AUTO
            : PrismaTaskApprovalMode.REVIEW,
        reviewerUserId: input.reviewerUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        repeatRule: input.repeatRule,
        createdBy: input.actorUserId,
        assignments: {
          create: (input.assigneeIds ?? []).map((userId) => ({ userId }))
        }
      },
      include: { assignments: true }
    });

    for (const assigneeId of input.assigneeIds ?? []) {
      await createNotification({
        userId: assigneeId,
        familyId: input.familyId,
        type: "task_assigned",
        title: "New task assigned",
        body: input.title,
        data: { taskId: task.id }
      });
    }

    return toTaskSummary(task);
  }

  const assigneeIds = input.assigneeIds ?? [];
  const createdAt = nowIso();
  const task: TaskSummary = {
    id: createId("task"),
    familyId: input.familyId,
    title: input.title,
    description: input.description,
    assigneeIds,
    assignmentMode: assignmentMode(assigneeIds),
    maxPoints: input.maxPoints,
    approvalMode: input.approvalMode,
    reviewerUserId: input.reviewerUserId,
    status: "open",
    dueAt: input.dueAt,
    repeatRule: input.repeatRule,
    createdAt,
    updatedAt: createdAt
  };

  getMemoryStore().tasks.push(task);

  for (const assigneeId of assigneeIds) {
    await createNotification({
      userId: assigneeId,
      familyId: input.familyId,
      type: "task_assigned",
      title: "New task assigned",
      body: input.title,
      data: { taskId: task.id }
    });
  }

  return task;
}

export async function getTask(input: GetTaskInput): Promise<TaskSummary | null> {
  if (usesDatabaseRuntime("tasks")) {
    const task = await prisma.task.findFirst({
      where: {
        id: input.taskId,
        familyId: input.familyId,
        deletedAt: null
      },
      include: { assignments: true }
    });

    return task ? toTaskSummary(task) : null;
  }

  return (
    getMemoryStore().tasks.find(
      (task) => task.familyId === input.familyId && task.id === input.taskId
    ) ?? null
  );
}

export async function updateTask(input: UpdateTaskInput): Promise<TaskSummary> {
  const task = await requireTask(input);
  const assigneeIds = input.assigneeIds ?? task.assigneeIds;

  task.title = input.title ?? task.title;
  task.description = input.description ?? task.description;
  task.assigneeIds = assigneeIds;
  task.assignmentMode = assignmentMode(assigneeIds);
  task.maxPoints = input.maxPoints ?? task.maxPoints;
  task.approvalMode = input.approvalMode ?? task.approvalMode;
  task.reviewerUserId =
    input.reviewerUserId === null
      ? undefined
      : input.reviewerUserId ?? task.reviewerUserId;
  task.dueAt = input.dueAt === null ? undefined : input.dueAt ?? task.dueAt;
  task.repeatRule =
    input.repeatRule === null ? undefined : input.repeatRule ?? task.repeatRule;
  task.updatedAt = nowIso();

  return task;
}

export async function deleteTask(input: DeleteTaskInput): Promise<{ id: string; deleted: true }> {
  const store = getMemoryStore();
  store.tasks = store.tasks.filter(
    (task) => !(task.familyId === input.familyId && task.id === input.taskId)
  );

  return { id: input.taskId, deleted: true };
}

export async function completeTask(input: CompleteTaskInput): Promise<TaskCompletion> {
  const task = await requireTask(input);
  if (usesDatabaseRuntime("tasks")) {
    return completeDatabaseTask(input, task);
  }

  const isAuto = task.approvalMode === "auto";
  const completion: TaskCompletion = {
    id: createId("task_completion"),
    taskId: input.taskId,
    familyId: input.familyId,
    completedByUserId: input.actorUserId,
    status: isAuto ? "approved" : "pending_review",
    awardedPoints: isAuto ? task.maxPoints : undefined,
    note: input.note,
    createdAt: nowIso(),
    reviewedAt: isAuto ? nowIso() : undefined,
    reviewedByUserId: isAuto ? input.actorUserId : undefined
  };

  getMemoryStore().taskCompletions.push(completion);

  if (isAuto) {
    await addPointLedgerEntry({
      familyId: input.familyId,
      actorUserId: input.actorUserId,
      userId: input.actorUserId,
      delta: task.maxPoints,
      reason: "task_auto_award",
      relatedEntityType: "task_completion",
      relatedEntityId: completion.id,
      note: task.title
    });
    await createNextRecurringTask(task, input.actorUserId);
  } else if (task.reviewerUserId) {
    await createNotification({
      userId: task.reviewerUserId,
      familyId: input.familyId,
      type: "task_pending_review",
      title: "Task pending review",
      body: task.title,
      data: { taskId: task.id, completionId: completion.id }
    });
  }

  return completion;
}

export async function reviewTask(input: ReviewTaskInput): Promise<TaskCompletion> {
  const task = await requireTask(input);
  if (usesDatabaseRuntime("tasks")) {
    return reviewDatabaseTask(input, task);
  }

  if (input.points > task.maxPoints) {
    throw new Error("Awarded points cannot exceed task maxPoints.");
  }

  const completion = getMemoryStore().taskCompletions.find(
    (item) =>
      item.familyId === input.familyId &&
      item.taskId === input.taskId &&
      item.id === input.completionId
  );

  if (!completion) {
    throw new Error("Task completion not found.");
  }
  if (completion.status !== "pending_review") {
    throw new Error("Task completion has already been reviewed.");
  }

  completion.status = input.approved ? "approved" : "rejected";
  completion.awardedPoints = input.approved ? input.points : 0;
  completion.note = input.note ?? completion.note;
  completion.reviewedAt = nowIso();
  completion.reviewedByUserId = input.actorUserId;

  if (input.approved && input.points > 0) {
    await addPointLedgerEntry({
      familyId: input.familyId,
      actorUserId: input.actorUserId,
      userId: completion.completedByUserId,
      delta: input.points,
      reason: "task_review_award",
      relatedEntityType: "task_completion",
      relatedEntityId: completion.id,
      note: task.title
    });
  }
  if (input.approved) {
    await createNextRecurringTask(task, input.actorUserId);
  }

  return completion;
}

async function completeDatabaseTask(
  input: CompleteTaskInput,
  task: TaskSummary
): Promise<TaskCompletion> {
  const isAuto = task.approvalMode === "auto";
  const completion = await prisma.taskCompletion.create({
    data: {
      taskId: input.taskId,
      completedBy: input.actorUserId,
      status: isAuto
        ? PrismaTaskCompletionStatus.APPROVED
        : PrismaTaskCompletionStatus.PENDING_REVIEW,
      awardedPoints: isAuto ? task.maxPoints : undefined,
      reviewedBy: isAuto ? input.actorUserId : undefined,
      reviewedAt: isAuto ? new Date() : undefined
    }
  });
  const mapped = toTaskCompletion(completion, input.familyId);

  if (isAuto) {
    await addPointLedgerEntry({
      familyId: input.familyId,
      actorUserId: input.actorUserId,
      userId: input.actorUserId,
      delta: task.maxPoints,
      reason: "task_auto_award",
      relatedEntityType: "task_completion",
      relatedEntityId: mapped.id,
      note: task.title
    });
    await createNextRecurringTask(task, input.actorUserId);
  } else if (task.reviewerUserId) {
    await createNotification({
      userId: task.reviewerUserId,
      familyId: input.familyId,
      type: "task_pending_review",
      title: "Task pending review",
      body: task.title,
      data: { taskId: task.id, completionId: mapped.id }
    });
  }

  return mapped;
}

async function reviewDatabaseTask(
  input: ReviewTaskInput,
  task: TaskSummary
): Promise<TaskCompletion> {
  if (input.points > task.maxPoints) {
    throw new Error("Awarded points cannot exceed task maxPoints.");
  }

  const existing = await prisma.taskCompletion.findFirst({
    where: {
      id: input.completionId,
      taskId: input.taskId
    }
  });

  if (!existing) {
    throw new Error("Task completion not found.");
  }
  if (existing.status !== PrismaTaskCompletionStatus.PENDING_REVIEW) {
    throw new Error("Task completion has already been reviewed.");
  }

  const completion = await prisma.taskCompletion.update({
    where: { id: input.completionId },
    data: {
      status: input.approved
        ? PrismaTaskCompletionStatus.APPROVED
        : PrismaTaskCompletionStatus.REJECTED,
      awardedPoints: input.approved ? input.points : 0,
      reviewedBy: input.actorUserId,
      reviewedAt: new Date()
    }
  });
  const mapped = toTaskCompletion(completion, input.familyId);

  if (input.approved && input.points > 0) {
    await addPointLedgerEntry({
      familyId: input.familyId,
      actorUserId: input.actorUserId,
      userId: mapped.completedByUserId,
      delta: input.points,
      reason: "task_review_award",
      relatedEntityType: "task_completion",
      relatedEntityId: mapped.id,
      note: task.title
    });
  }
  if (input.approved) {
    await createNextRecurringTask(task, input.actorUserId);
  }

  return mapped;
}

async function createNextRecurringTask(task: TaskSummary, actorUserId: string) {
  const dueAt = nextRecurringDueAt(task.dueAt, task.repeatRule);
  if (!dueAt) return;

  await createTask({
    familyId: task.familyId,
    actorUserId,
    title: task.title,
    description: task.description,
    assigneeIds: task.assigneeIds,
    maxPoints: task.maxPoints,
    approvalMode: task.approvalMode,
    reviewerUserId: task.reviewerUserId,
    dueAt,
    repeatRule: task.repeatRule
  });
}

function nextRecurringDueAt(dueAt: string | undefined, repeatRule: string | undefined) {
  if (!repeatRule) return undefined;

  const next = new Date(dueAt ?? nowIso());
  if (Number.isNaN(next.getTime())) return undefined;

  const normalized = repeatRule.toLowerCase();
  if (normalized === "daily" || normalized.includes("daily")) {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (normalized === "weekly" || normalized.includes("weekly")) {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (normalized === "monthly" || normalized.includes("monthly")) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    return undefined;
  }

  return next.toISOString();
}

async function requireTask(input: GetTaskInput) {
  const task = await getTask(input);

  if (!task) {
    throw new Error("Task not found.");
  }

  return task;
}

function toTaskSummary(task: {
  id: string;
  familyId: string;
  title: string;
  description: string;
  maxPoints: number;
  approvalMode: PrismaTaskApprovalMode;
  reviewerUserId: string | null;
  dueAt: Date | null;
  repeatRule: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignments: Array<{ userId: string }>;
}): TaskSummary {
  const assigneeIds = task.assignments.map((assignment) => assignment.userId);
  return {
    id: task.id,
    familyId: task.familyId,
    title: task.title,
    description: task.description || undefined,
    assigneeIds,
    assignmentMode: assignmentMode(assigneeIds),
    maxPoints: task.maxPoints,
    approvalMode: task.approvalMode === PrismaTaskApprovalMode.AUTO ? "auto" : "review",
    reviewerUserId: task.reviewerUserId ?? undefined,
    status: "open",
    dueAt: task.dueAt?.toISOString(),
    repeatRule: task.repeatRule ?? undefined,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

function toTaskCompletion(
  completion: {
    id: string;
    taskId: string;
    completedBy: string;
    status: PrismaTaskCompletionStatus | null;
    awardedPoints: number | null;
    reviewedBy: string | null;
    completedAt: Date;
    reviewedAt: Date | null;
  },
  familyId: string
): TaskCompletion {
  return {
    id: completion.id,
    taskId: completion.taskId,
    familyId,
    completedByUserId: completion.completedBy,
    status: toTaskCompletionStatus(completion.status),
    awardedPoints: completion.awardedPoints ?? undefined,
    createdAt: completion.completedAt.toISOString(),
    reviewedAt: completion.reviewedAt?.toISOString(),
    reviewedByUserId: completion.reviewedBy ?? undefined
  };
}

function toTaskCompletionStatus(
  status: PrismaTaskCompletionStatus | null
): TaskCompletion["status"] {
  if (status === PrismaTaskCompletionStatus.APPROVED) return "approved";
  if (status === PrismaTaskCompletionStatus.REJECTED) return "rejected";
  return "pending_review";
}
