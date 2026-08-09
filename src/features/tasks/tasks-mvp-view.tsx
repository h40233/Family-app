"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useActiveFamily } from "@/features/families/use-active-family";
import { useOnlineStatus } from "@/features/money/use-online-status";
import { apiRequest, errorMessage } from "@/lib/api-client";

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
  repeatRule?: string;
};
type TaskCompletion = {
  id: string;
  taskId: string;
  completedByUserId: string;
  status: TaskCompletionStatus;
  awardedPoints?: number;
};
type FamilyMember = {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  role: string;
  isChildAccount: boolean;
};
type MembersResponse = { members: FamilyMember[] };

function statusLabel(task: TaskSummary, completion?: TaskCompletion) {
  if (completion?.status === "pending_review") return "等待審核";
  if (completion?.status === "approved") return `已通過 +${completion.awardedPoints ?? 0}`;
  if (completion?.status === "rejected") return "已駁回";
  if (task.status === "completed") return "已完成";
  return task.approvalMode === "auto" ? "自動發分" : "需要審核";
}

function activeFamilyMessage(status: Exclude<ReturnType<typeof useActiveFamily>["status"], "ready">) {
  if (status === "loading") return "正在載入登入與家庭資料。";
  if (status === "auth") return "請先登入，才能查看家庭任務。";
  if (status === "empty") return "目前帳號還沒有加入任何家庭。";
  return "家庭資料載入失敗。";
}

export function TasksMvpView() {
  const activeFamily = useActiveFamily();
  const online = useOnlineStatus();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [completions, setCompletions] = useState<Record<string, TaskCompletion>>({});
  const [title, setTitle] = useState("");
  const [maxPoints, setMaxPoints] = useState(10);
  const [approvalMode, setApprovalMode] = useState<TaskApprovalMode>("auto");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [repeatRule, setRepeatRule] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members]
  );

  const stats = useMemo(() => {
    const pendingReview = Object.values(completions).filter((item) => item.status === "pending_review").length;
    const open = tasks.filter((task) => task.status === "open").length;
    const totalPoints = tasks.reduce((sum, task) => sum + task.maxPoints, 0);
    return { open, pendingReview, totalPoints };
  }, [completions, tasks]);

  const loadTasks = useCallback(async (familyId: string, currentUserId: string) => {
    setLoading(true);
    try {
      const [loadedTasks, membersResponse] = await Promise.all([
        apiRequest<TaskSummary[]>(`/api/v1/families/${familyId}/tasks`),
        apiRequest<MembersResponse>(`/api/v1/families/${familyId}/members`)
      ]);
      setTasks(loadedTasks);
      setMembers(membersResponse.members);
      setSelectedAssigneeId((current) => current || currentUserId);
      setSelectedReviewerId((current) => current || currentUserId);
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeFamily.status !== "ready") {
      setLoading(activeFamily.status === "loading");
      return;
    }

    void loadTasks(activeFamily.family.id, activeFamily.user.id);
  }, [activeFamily, loadTasks]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeFamily.status !== "ready") return;
    if (!online) {
      setMessage("離線時不能修改任務。");
      return;
    }
    if (!title.trim()) return;
    const assigneeId = selectedAssigneeId || activeFamily.user.id;
    const reviewerUserId = selectedReviewerId || activeFamily.user.id;

    try {
      const task = await apiRequest<TaskSummary>(`/api/v1/families/${activeFamily.family.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          maxPoints,
          approvalMode,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          repeatRule: repeatRule || undefined,
          assigneeIds: [assigneeId],
          reviewerUserId: approvalMode === "review" ? reviewerUserId : undefined
        })
      });
      setTasks((current) => [task, ...current]);
      setTitle("");
      setMaxPoints(10);
      setDueAt("");
      setRepeatRule("");
      setMessage("任務已建立。");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function completeTask(task: TaskSummary) {
    if (activeFamily.status !== "ready") return;
    if (!online) {
      setMessage("離線時不能完成任務。");
      return;
    }

    try {
      const completion = await apiRequest<TaskCompletion>(`/api/v1/families/${activeFamily.family.id}/tasks/${task.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ note: "由任務頁完成" })
      });
      setCompletions((current) => ({ ...current, [task.id]: completion }));
      setMessage(completion.status === "pending_review" ? "已送出審核。" : `任務已完成，獲得 ${completion.awardedPoints ?? 0} 點。`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function reviewTask(task: TaskSummary, approved: boolean) {
    if (activeFamily.status !== "ready") return;
    if (!online) {
      setMessage("離線時不能審核任務。");
      return;
    }
    const completion = completions[task.id];
    if (!completion) return;

    try {
      const reviewed = await apiRequest<TaskCompletion>(`/api/v1/families/${activeFamily.family.id}/tasks/${task.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          completionId: completion.id,
          approved,
          points: approved ? task.maxPoints : 0,
          note: approved ? "由任務頁通過" : "由任務頁駁回"
        })
      });
      setCompletions((current) => ({ ...current, [task.id]: reviewed }));
      setMessage(approved ? `審核通過，發放 ${reviewed.awardedPoints ?? 0} 點。` : "審核已駁回。");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  if (activeFamily.status !== "ready") {
    const displayMessage = "message" in activeFamily ? activeFamily.message : activeFamilyMessage(activeFamily.status);

    return (
      <>
        <PageHeader eyebrow="任務清單" title="家庭任務" description="建立任務、設定點數、完成家務，並審核需要確認的任務。" />
        <section className="panel">
          <h2>任務資料</h2>
          <p className="page-description">{displayMessage}</p>
        </section>
      </>
    );
  }

  const defaultMemberOptions = members.length > 0
    ? members
    : [{
        id: activeFamily.user.id,
        familyId: activeFamily.family.id,
        userId: activeFamily.user.id,
        displayName: activeFamily.user.displayName,
        role: "member",
        isChildAccount: activeFamily.user.isChildAccount
      }];

  return (
    <>
      <PageHeader eyebrow="任務清單" title="家庭任務" description={`${activeFamily.family.name} 的任務、點數與審核狀態。`} />
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
              const assignees = task.assigneeIds.map((id) => memberNameById.get(id) ?? id).join("、") || "未指派";

              return (
                <div className="module-row" key={task.id}>
                  <div>
                    <span>{task.title}</span>
                    <small>{task.maxPoints} 點 / {task.approvalMode === "auto" ? "自動" : "審核"} / {statusLabel(task, completion)}</small>
                    <small>指派給 {assignees}</small>
                    {task.dueAt ? <small>期限 {new Date(task.dueAt).toLocaleString()}</small> : null}
                    {task.repeatRule ? <small>重複：{task.repeatRule}</small> : null}
                  </div>
                  <div className="topbar-action">
                    <button type="button" onClick={() => void completeTask(task)} disabled={!online} style={{ whiteSpace: "nowrap" }}>完成</button>
                    {completion?.status === "pending_review" ? (
                      <>
                        <button type="button" onClick={() => void reviewTask(task, true)} disabled={!online} style={{ whiteSpace: "nowrap" }}>通過</button>
                        <button type="button" onClick={() => void reviewTask(task, false)} disabled={!online} style={{ background: "var(--danger)", whiteSpace: "nowrap" }}>駁回</button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!loading && tasks.length === 0 ? <p className="muted">目前沒有任務。</p> : null}
          </div>
        </section>
        <section className="panel">
          <h2>建立任務</h2>
          <form className="module-list" onSubmit={(event) => void createTask(event)}>
            <label><small>任務名稱</small><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label><small>最高點數</small><input min={0} type="number" value={maxPoints} onChange={(event) => setMaxPoints(Number(event.target.value))} /></label>
            <label>
              <small>指派給</small>
              <select value={selectedAssigneeId || activeFamily.user.id} onChange={(event) => setSelectedAssigneeId(event.target.value)}>
                {defaultMemberOptions.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
              </select>
            </label>
            <label>
              <small>審核模式</small>
              <select value={approvalMode} onChange={(event) => setApprovalMode(event.target.value as TaskApprovalMode)}>
                <option value="auto">自動發分</option>
                <option value="review">需要審核</option>
              </select>
            </label>
            {approvalMode === "review" ? (
              <label>
                <small>審核者</small>
                <select value={selectedReviewerId || activeFamily.user.id} onChange={(event) => setSelectedReviewerId(event.target.value)}>
                  {defaultMemberOptions.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
                </select>
              </label>
            ) : null}
            <label><small>期限</small><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            <label>
              <small>重複規則</small>
              <select value={repeatRule} onChange={(event) => setRepeatRule(event.target.value)}>
                <option value="">不重複</option>
                <option value="daily">每日</option>
                <option value="weekly">每週</option>
                <option value="monthly">每月</option>
              </select>
            </label>
            <button type="submit" disabled={loading || !online}>建立任務</button>
          </form>
        </section>
      </div>
    </>
  );
}
