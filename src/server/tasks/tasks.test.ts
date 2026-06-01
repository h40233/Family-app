import { beforeEach, describe, expect, it } from "vitest";
import { getMyPointBalance, listPointLedger } from "@/server/points";
import { resetMemoryStore } from "@/server/store";
import { completeTask, createTask, reviewTask } from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("task service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("awards points immediately when an auto task is completed", async () => {
    const task = await createTask({
      familyId,
      actorUserId,
      title: "Test chore",
      assigneeIds: [actorUserId],
      maxPoints: 12,
      approvalMode: "auto"
    });

    const completion = await completeTask({
      familyId,
      taskId: task.id,
      actorUserId
    });

    const balance = await getMyPointBalance({ familyId, actorUserId });
    const ledger = await listPointLedger({ familyId });

    expect(completion.status).toBe("approved");
    expect(completion.awardedPoints).toBe(12);
    expect(balance.balance).toBe(12);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0].reason).toBe("task_auto_award");
  });

  it("keeps review tasks pending until reviewer awards points", async () => {
    const task = await createTask({
      familyId,
      actorUserId,
      title: "?渡?摰Ｗ輒",
      assigneeIds: [actorUserId],
      maxPoints: 20,
      approvalMode: "review"
    });

    const completion = await completeTask({
      familyId,
      taskId: task.id,
      actorUserId
    });

    expect(completion.status).toBe("pending_review");
    expect((await getMyPointBalance({ familyId, actorUserId })).balance).toBe(0);

    const reviewed = await reviewTask({
      familyId,
      taskId: task.id,
      completionId: completion.id,
      actorUserId,
      approved: true,
      points: 15
    });

    expect(reviewed.status).toBe("approved");
    expect(reviewed.awardedPoints).toBe(15);
    expect((await getMyPointBalance({ familyId, actorUserId })).balance).toBe(15);
  });

  it("rejects review awards above the task maximum", async () => {
    const task = await createTask({
      familyId,
      actorUserId,
      title: "瘣?",
      maxPoints: 5,
      approvalMode: "review"
    });
    const completion = await completeTask({ familyId, taskId: task.id, actorUserId });

    await expect(
      reviewTask({
        familyId,
        taskId: task.id,
        completionId: completion.id,
        actorUserId,
        approved: true,
        points: 6
      })
    ).rejects.toThrow("Awarded points cannot exceed task maxPoints.");
  });
});
