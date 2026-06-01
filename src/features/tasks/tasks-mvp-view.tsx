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
  assigneeIds: string[];
  assignmentMode: "single" | "multiple" | "open";
  maxPoints: number;
  approvalMode: TaskApprovalMode;
  reviewerUserId?: string;
  status: TaskStatus;
  dueAt?: string;
};
type TaskCompletion = {
  id: string;
  taskId: string;
  completedByUserId: string;
  status: TaskCompletionStatus;
  awardedPoints?: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `請求失敗：${response.status}`);
  }
  return payload.data as T;
}

function statusLabel(task: TaskSummary, completion?: TaskCompletion) {
  if (completion?.status === "pending_review") return "等待審核";
  if (completion?.status === "approved") return `已通過 +${completion.awardedPoints ?? 0}`;
  if (completion?.status === "rejected") return "已駁回";
  if (task.status === "completed") return "已完成";
  return task.approvalMode === "auto" ? "自動發分" : "需要審核";
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
      setMessage(error instanceof Error ? error.message : "任務載入失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const stats = useMemo(() => {
    const pendingReview = Object.values(completions).filter((item) => item.status === "pending_review").length;
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
      setMessage("任務已建立。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任務建立失敗。");
    }
  }

  async function completeTask(task: TaskSummary) {
    try {
      const completion = await api<TaskCompletion>(`/api/v1/families/${FAMILY_ID}/tasks/${task.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ note: "由 MVP 介面完成" })
      });
      setCompletions((current) => ({ ...current, [task.id]: completion }));
      setMessage(completion.status === "pending_review" ? "已送出審核。" : `任務已完成，獲得 ${completion.awardedPoints ?? 0} 點。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任務完成失敗。");
    }
  }

  async function reviewTask(task: TaskSummary, approved: boolean) {
    const completion = completions[task.id];
    if (!completion) return;
    try {
      const reviewed = await api<TaskCompletion>(`/api/v1/families/${FAMILY_ID}/tasks/${task.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          completionId: completion.id,
          approved,
          points: approved ? task.maxPoints : 0,
          note: approved ? "由 MVP 介面通過" : "由 MVP 介面駁回"
        })
      });
      setCompletions((current) => ({ ...current, [task.id]: reviewed }));
      setMessage(approved ? `審核通過，發放 ${reviewed.awardedPoints ?? 0} 點。` : "審核已駁回。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "審核失敗。");
    }
  }

  return (
    <>
      <PageHeader eyebrow="任務清單" title="家庭任務" description="建立任務、設定點數、完成家務，並審核需要確認的任務。" />
      <div className="summary-grid">
        <article><p>任務總數</p><strong>{tasks.length}</strong></article>
        <article><p>進行中</p><strong>{stats.open}</strong></article>
        <article><p>待審核</p><strong>{stats.pendingReview}</strong></article>
        <article><p>可獲得點數</p><strong>{stats.totalPoints}</strong></article>
      </div>
      <div className="content-grid">
        <section className="panel">
          <h2>任務列表</h2>
          {loading ? <p className="muted">載入中...</p> : null}
          {message ? <p className="page-description">{message}</p> : null}
          <div className="module-list">
            {tasks.map((task) => {
              const completion = completions[task.id];
              return (
                <div className="module-row" key={task.id}>
                  <div>
                    <span>{task.title}</span>
                    <small>{task.maxPoints} 點 / {task.approvalMode === "auto" ? "自動" : "審核"} / {statusLabel(task, completion)}</small>
                    {task.dueAt ? <small>期限 {new Date(task.dueAt).toLocaleString()}</small> : null}
                  </div>
                  <div className="topbar-action">
                    <button type="button" onClick={() => void completeTask(task)} style={{ whiteSpace: "nowrap" }}>完成</button>
                    {completion?.status === "pending_review" ? (
                      <>
                        <button type="button" onClick={() => void reviewTask(task, true)} style={{ whiteSpace: "nowrap" }}>通過</button>
                        <button type="button" onClick={() => void reviewTask(task, false)} style={{ background: "var(--danger)", whiteSpace: "nowrap" }}>駁回</button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <h2>建立任務</h2>
          <form className="module-list" onSubmit={(event) => void createTask(event)}>
            <label><small>任務名稱</small><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label><small>最高點數</small><input min={0} type="number" value={maxPoints} onChange={(event) => setMaxPoints(Number(event.target.value))} /></label>
            <label>
              <small>審核模式</small>
              <select value={approvalMode} onChange={(event) => setApprovalMode(event.target.value as TaskApprovalMode)}>
                <option value="auto">自動發分</option>
                <option value="review">需要審核</option>
              </select>
            </label>
            <label><small>期限</small><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            <button type="submit">建立任務</button>
          </form>
        </section>
      </div>
    </>
  );
}
