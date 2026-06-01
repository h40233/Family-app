"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";

const FAMILY_ID = "00000000-0000-4000-8000-000000001001";
const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";

type ApiEnvelope<T> = { data?: T; error?: { message: string } };

type TaskApprovalMode = "auto" | "review";
type TaskStatus = "open" | "completed" | "cancelled";
type TaskCompletionStatus = "completed" | "pending_review" | "approved" | "rejected";

type TaskSummary = {
  id: string;
  title: string;
  description?: string;
  assigneeIds: string[];
  assignmentMode: "single" | "multiple" | "open";
  maxPoints: number;
  approvalMode: TaskApprovalMode;
  reviewerUserId?: string;
  status: TaskStatus;
  dueAt?: string;
  repeatRule?: string;
};

type TaskCompletion = {
  id: string;
  taskId: string;
  completedByUserId: string;
  status: TaskCompletionStatus;
  awardedPoints?: number;
  note?: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  }

  return payload.data as T;
}

function statusLabel(task: TaskSummary, completion?: TaskCompletion) {
  if (completion?.status === "pending_review") return "Pending review";
  if (completion?.status === "approved") return `Approved +${completion.awardedPoints ?? 0}`;
  if (completion?.status === "rejected") return "Rejected";
  if (task.status === "completed") return "Completed";
  return task.approvalMode === "auto" ? "Auto award" : "Needs review";
}

export function TasksMvpView() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [completions, setCompletions] = useState<Record<string, TaskCompletion>>({});
  const [title, setTitle] = useState("");
  const [maxPoints, setMaxPoints] = useState(10);
  const [approvalMode, setApprovalMode] = useState<TaskApprovalMode>("auto");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTasks() {
    setLoading(true);
    try {
      setTasks(await api<TaskSummary[]>(`/api/v1/families/${FAMILY_ID}/tasks`));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const stats = useMemo(() => {
    const pendingReview = Object.values(completions).filter(
      (completion) => completion.status === "pending_review"
    ).length;
    const open = tasks.filter((task) => task.status === "open").length;
    const totalPoints = tasks.reduce((sum, task) => sum + task.maxPoints, 0);

    return { open, pendingReview, totalPoints };
  }, [completions, tasks]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    try {
      const task = await api<TaskSummary>(`/api/v1/families/${FAMILY_ID}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          maxPoints,
          approvalMode,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          assigneeIds: [DEFAULT_USER_ID],
          reviewerUserId: approvalMode === "review" ? DEFAULT_USER_ID : undefined
        })
      });
      setTasks((current) => [task, ...current]);
      setTitle("");
      setMaxPoints(10);
      setDueAt("");
      setMessage("Task created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create task.");
    }
  }

  async function completeTask(task: TaskSummary) {
    try {
      const completion = await api<TaskCompletion>(
        `/api/v1/families/${FAMILY_ID}/tasks/${task.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ note: "Completed from MVP UI" })
        }
      );
      setCompletions((current) => ({ ...current, [task.id]: completion }));
      setMessage(
        completion.status === "pending_review"
          ? "Sent for review."
          : `Task completed. Awarded ${completion.awardedPoints ?? 0} points.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to complete task.");
    }
  }

  async function reviewTask(task: TaskSummary, approved: boolean) {
    const completion = completions[task.id];
    if (!completion) return;

    try {
      const reviewed = await api<TaskCompletion>(
        `/api/v1/families/${FAMILY_ID}/tasks/${task.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            completionId: completion.id,
            approved,
            points: approved ? task.maxPoints : 0,
            note: approved ? "Approved from MVP UI" : "Rejected from MVP UI"
          })
        }
      );
      setCompletions((current) => ({ ...current, [task.id]: reviewed }));
      setMessage(
        approved
          ? `Review approved. Awarded ${reviewed.awardedPoints ?? 0} points.`
          : "Review rejected."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to review task.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Family tasks"
        description="Create tasks, assign points, complete chores, and review submissions."
      />

      <div className="summary-grid">
        <article>
          <p>Total tasks</p>
          <strong>{tasks.length}</strong>
        </article>
        <article>
          <p>Open</p>
          <strong>{stats.open}</strong>
        </article>
        <article>
          <p>Pending review</p>
          <strong>{stats.pendingReview}</strong>
        </article>
        <article>
          <p>Total points</p>
          <strong>{stats.totalPoints}</strong>
        </article>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>Tasks</h2>
          {loading ? <p className="muted">Loading...</p> : null}
          {message ? <p className="page-description">{message}</p> : null}
          <div className="module-list">
            {tasks.map((task) => {
              const completion = completions[task.id];
              return (
                <div className="module-row" key={task.id}>
                  <div>
                    <span>{task.title}</span>
                    <small>
                      {task.maxPoints} pts · {task.approvalMode} ·{" "}
                      {statusLabel(task, completion)}
                    </small>
                    {task.dueAt ? <small>Due {new Date(task.dueAt).toLocaleString()}</small> : null}
                  </div>
                  <div className="topbar-action">
                    <button
                      type="button"
                      onClick={() => void completeTask(task)}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Complete
                    </button>
                    {completion?.status === "pending_review" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void reviewTask(task, true)}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewTask(task, false)}
                          style={{ background: "var(--danger)", whiteSpace: "nowrap" }}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2>Create task</h2>
          <form className="module-list" onSubmit={(event) => void createTask(event)}>
            <label>
              <small>Task title</small>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <small>Max points</small>
              <input
                min={0}
                type="number"
                value={maxPoints}
                onChange={(event) => setMaxPoints(Number(event.target.value))}
              />
            </label>
            <label>
              <small>Approval mode</small>
              <select
                value={approvalMode}
                onChange={(event) => setApprovalMode(event.target.value as TaskApprovalMode)}
              >
                <option value="auto">Auto</option>
                <option value="review">Review</option>
              </select>
            </label>
            <label>
              <small>Due date</small>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
            <button type="submit">Create task</button>
          </form>
        </section>
      </div>
    </>
  );
}
