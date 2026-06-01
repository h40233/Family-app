export type TaskApprovalMode = "auto" | "review";
export type TaskStatus = "open" | "completed" | "cancelled";
export type TaskCompletionStatus = "completed" | "pending_review" | "approved" | "rejected";

export type TaskAssignmentMode = "single" | "multiple" | "open";

export type TaskSummary = {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  assigneeIds: string[];
  assignmentMode: TaskAssignmentMode;
  maxPoints: number;
  approvalMode: TaskApprovalMode;
  reviewerUserId?: string;
  status: TaskStatus;
  dueAt?: string;
  repeatRule?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskCompletion = {
  id: string;
  taskId: string;
  familyId: string;
  completedByUserId: string;
  status: TaskCompletionStatus;
  awardedPoints?: number;
  note?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
};

export type ListTasksInput = {
  familyId: string;
  status?: TaskStatus;
  assigneeId?: string;
};

export type CreateTaskInput = {
  familyId: string;
  actorUserId: string;
  title: string;
  description?: string;
  assigneeIds?: string[];
  maxPoints: number;
  approvalMode: TaskApprovalMode;
  reviewerUserId?: string;
  dueAt?: string;
  repeatRule?: string;
};

export type GetTaskInput = {
  familyId: string;
  taskId: string;
};

export type UpdateTaskInput = GetTaskInput & {
  actorUserId: string;
  title?: string;
  description?: string;
  assigneeIds?: string[];
  maxPoints?: number;
  approvalMode?: TaskApprovalMode;
  reviewerUserId?: string | null;
  dueAt?: string | null;
  repeatRule?: string | null;
};

export type DeleteTaskInput = GetTaskInput & {
  actorUserId: string;
};

export type CompleteTaskInput = GetTaskInput & {
  actorUserId: string;
  note?: string;
};

export type ReviewTaskInput = GetTaskInput & {
  actorUserId: string;
  completionId: string;
  approved: boolean;
  points: number;
  note?: string;
};
