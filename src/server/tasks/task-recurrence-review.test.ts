import { beforeEach, describe, expect, it } from "vitest";
import { devFixtureIds } from "@/server/dev-fixtures";
import { getMyPointBalance } from "@/server/points";
import { resetMemoryStore } from "@/server/store";
import { completeTask, createTask, listTasks, reviewTask } from "./service";

const familyId = devFixtureIds.family;
const actorUserId = devFixtureIds.ownerUser;

describe("task recurrence and review flow", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("creates the next weekly task when a recurring auto-award task is completed", async () => {
    const task = await createTask({
      familyId,
      actorUserId,
      title: "Weekly reset",
      assigneeIds: [actorUserId],
      maxPoints: 10,
      approvalMode: "auto",
      dueAt: "2026-05-04T09:00:00.000Z",
      repeatRule: "weekly"
    });

    await completeTask({ familyId, taskId: task.id, actorUserId });

    const tasks = await listTasks({ familyId });
    expect(tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Weekly reset",
          dueAt: "2026-05-11T09:00:00.000Z",
          repeatRule: "weekly",
          assigneeIds: [actorUserId],
          maxPoints: 10,
          approvalMode: "auto"
        })
      ])
    );
  });

  it("creates the next recurring review task only after approval", async () => {
    const task = await createTask({
      familyId,
      actorUserId,
      title: "Reviewed weekly reset",
      assigneeIds: [actorUserId],
      maxPoints: 20,
      approvalMode: "review",
      reviewerUserId: actorUserId,
      dueAt: "2026-05-04T09:00:00.000Z",
      repeatRule: "weekly"
    });
    const completion = await completeTask({ familyId, taskId: task.id, actorUserId });

    expect((await listTasks({ familyId })).filter((item) => item.title === "Reviewed weekly reset")).toHaveLength(1);

    await reviewTask({
      familyId,
      taskId: task.id,
      completionId: completion.id,
      actorUserId,
      approved: true,
      points: 12
    });

    expect((await listTasks({ familyId })).filter((item) => item.title === "Reviewed weekly reset")).toHaveLength(2);
  });

  it("rejects reviewing the same completion twice", async () => {
    const task = await createTask({
      familyId,
      actorUserId,
      title: "Reviewed once",
      assigneeIds: [actorUserId],
      maxPoints: 20,
      approvalMode: "review"
    });
    const completion = await completeTask({ familyId, taskId: task.id, actorUserId });

    await reviewTask({
      familyId,
      taskId: task.id,
      completionId: completion.id,
      actorUserId,
      approved: true,
      points: 12
    });

    await expect(
      reviewTask({
        familyId,
        taskId: task.id,
        completionId: completion.id,
        actorUserId,
        approved: true,
        points: 12
      })
    ).rejects.toThrow("Task completion has already been reviewed.");
    expect((await getMyPointBalance({ familyId, actorUserId })).balance).toBe(12);
  });
});
