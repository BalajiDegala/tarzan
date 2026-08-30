import type {
  AuthSession,
  ProjectListResponse,
  ProjectResponse,
  TeamListResponse,
  TeamMemberResponse,
  TeamResponse,
  TeamRole,
} from '@tarzan/types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';

    try {
      const body = (await response.json()) as {
        message?: string | string[];
      };

      if (Array.isArray(body.message)) {
        message = body.message[0] ?? message;
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // Preserve the safe fallback when the server has no JSON error body.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  getSession: () => request<AuthSession>('/auth/me'),
  login: (input: { email: string; password: string }) =>
    request<AuthSession>('/auth/login', {
      body: JSON.stringify(input),
      method: 'POST',
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  register: (input: { email: string; name: string; password: string }) =>
    request<AuthSession>('/auth/register', {
      body: JSON.stringify(input),
      method: 'POST',
    }),
};

export const teamsApi = {
  addMember: (teamId: string, input: { email: string; role: TeamRole }) =>
    request<TeamMemberResponse>(
      `/teams/${encodeURIComponent(teamId)}/members`,
      {
        body: JSON.stringify(input),
        method: 'POST',
      },
    ),
  create: (input: { name: string }) =>
    request<TeamResponse>('/teams', {
      body: JSON.stringify(input),
      method: 'POST',
    }),
  get: (teamId: string) =>
    request<TeamResponse>(`/teams/${encodeURIComponent(teamId)}`),
  list: () => request<TeamListResponse>('/teams'),
  removeMember: (teamId: string, userId: string) =>
    request<void>(
      `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
};

export const projectsApi = {
  create: (input: { description?: string; name: string; teamId: string }) =>
    request<ProjectResponse>('/projects', {
      body: JSON.stringify(input),
      method: 'POST',
    }),
  get: (projectId: string) =>
    request<ProjectResponse>(`/projects/${encodeURIComponent(projectId)}`),
  list: (teamId?: string) =>
    request<ProjectListResponse>(
      `/projects${
        teamId === undefined ? '' : `?teamId=${encodeURIComponent(teamId)}`
      }`,
    ),
  update: (projectId: string, input: { description?: string; name?: string }) =>
    request<ProjectResponse>(`/projects/${encodeURIComponent(projectId)}`, {
      body: JSON.stringify(input),
      method: 'PATCH',
    }),
};
