export interface ServiceHealth {
  name: string;
  status: 'ok';
  version: string;
}

export type UserRole = 'ADMIN' | 'MEMBER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
}

export type TeamRole = 'ADMIN' | 'MEMBER';

export interface TeamSummary {
  createdAt: string;
  id: string;
  memberCount: number;
  name: string;
  role: TeamRole;
  updatedAt: string;
}

export interface TeamMemberDetails {
  email: string;
  joinedAt: string;
  name: string;
  role: TeamRole;
  userId: string;
}

export interface TeamDetails extends TeamSummary {
  createdBy: {
    id: string;
    name: string;
  };
  members: TeamMemberDetails[];
}

export interface TeamListResponse {
  teams: TeamSummary[];
}

export interface TeamResponse {
  team: TeamDetails;
}

export interface TeamMemberResponse {
  member: TeamMemberDetails;
}

export interface ProjectSummary {
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamRole: TeamRole;
  updatedAt: string;
}

export interface ProjectDetails extends ProjectSummary {
  createdBy: {
    id: string;
    name: string;
  };
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectResponse {
  project: ProjectDetails;
}

export type TaskType = 'TASK' | 'BUG' | 'STORY';
export type TaskStatus =
  'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskUser {
  id: string;
  name: string;
}

export interface TaskSummary {
  assignee: TaskUser | null;
  createdAt: string;
  dueDate: string | null;
  id: string;
  priority: TaskPriority;
  projectId: string;
  projectName: string;
  status: TaskStatus;
  taskKey: string;
  teamRole: TeamRole;
  title: string;
  type: TaskType;
  updatedAt: string;
}

export interface TaskDetails extends TaskSummary {
  description: string | null;
  labels: string[];
  reporter: TaskUser;
}

export interface TaskListResponse {
  tasks: TaskSummary[];
}

export interface TaskResponse {
  task: TaskDetails;
}
