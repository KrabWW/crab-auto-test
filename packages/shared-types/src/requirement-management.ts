/** Requirement management contracts: project-scoped versioned requirements. */
export type RequirementStatus = "draft" | "in-review" | "approved" | "rejected" | "archived";
export type RequirementTransitionAction =
  | "create"
  | "update"
  | "submit-review"
  | "approve"
  | "reject"
  | "archive"
  | "delete";

export interface RequirementVersionDto {
  id: string;
  requirementId: string;
  projectId: string;
  version: number;
  title: string;
  content: string;
  status: RequirementStatus;
  createdBy: string;
  reviewedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
}

export interface RequirementReviewEventDto {
  id: string;
  requirementId: string;
  projectId: string;
  fromStatus?: RequirementStatus;
  toStatus: RequirementStatus;
  action: RequirementTransitionAction;
  actorId: string;
  createdAt: string;
}

export interface RequirementDto {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: RequirementStatus;
  version: number;
  createdBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
  versions: RequirementVersionDto[];
  reviewEvents: RequirementReviewEventDto[];
}

export interface CreateRequirementRequest {
  title: string;
  content: string;
}

export type UpdateRequirementRequest = Partial<CreateRequirementRequest>;
