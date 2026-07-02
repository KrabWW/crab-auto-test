/** Project management contracts (platform-foundation.2). */
import type { ProjectRole } from "./auth";

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedAt: string;
  acceptedAt?: string;
}

export interface AddMemberRequest {
  userId: string;
  role: ProjectRole;
}
