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
