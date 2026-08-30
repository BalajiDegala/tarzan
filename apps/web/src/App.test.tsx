import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from './App';
import { AuthProvider } from './auth/AuthContext';

const authenticatedUser = {
  createdAt: '2026-08-30T07:30:00.000Z',
  email: 'balaji@example.com',
  id: 'd53da168-40e6-40c8-85c1-47cc261ef4b8',
  name: 'Balaji Ravi',
  role: 'MEMBER' as const,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authentication flow', () => {
  it('shows registration fields when there is no active session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: 'Authentication required' }, 401),
        ),
    );

    renderApp('/register');

    expect(
      await screen.findByRole('heading', { name: 'Start with Tarzan.' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create account' }),
    ).toBeEnabled();
  });

  it('signs in and opens the protected workspace', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Authentication required' }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ user: authenticatedUser }))
      .mockResolvedValueOnce(jsonResponse({ teams: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderApp('/login');

    await user.type(
      await screen.findByLabelText('Email address'),
      'balaji@example.com',
    );
    await user.type(screen.getByLabelText('Password'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Delivery board' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Workspace sections' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute(
      'href',
      '/board',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('creates the first team for an authenticated user', async () => {
    const team = {
      createdAt: '2026-08-30T08:20:00.000Z',
      createdBy: { id: authenticatedUser.id, name: authenticatedUser.name },
      id: '3cb79f02-b617-4f61-ac60-a56ee4998b53',
      memberCount: 1,
      members: [
        {
          email: authenticatedUser.email,
          joinedAt: '2026-08-30T08:20:00.000Z',
          name: authenticatedUser.name,
          role: 'ADMIN',
          userId: authenticatedUser.id,
        },
      ],
      name: 'Platform',
      role: 'ADMIN',
      updatedAt: '2026-08-30T08:20:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: authenticatedUser }))
      .mockResolvedValueOnce(jsonResponse({ teams: [] }))
      .mockResolvedValueOnce(jsonResponse({ team }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderApp('/teams');

    await user.type(await screen.findByLabelText('New team'), 'Platform');
    await user.click(screen.getByRole('button', { name: 'Create team' }));

    expect(
      await screen.findByRole('heading', { name: 'Platform' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 member · admin')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Team workspaces' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/teams$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates a project inside an administered team', async () => {
    const team = {
      createdAt: '2026-08-30T08:20:00.000Z',
      createdBy: { id: authenticatedUser.id, name: authenticatedUser.name },
      id: '3cb79f02-b617-4f61-ac60-a56ee4998b53',
      memberCount: 1,
      members: [
        {
          email: authenticatedUser.email,
          joinedAt: '2026-08-30T08:20:00.000Z',
          name: authenticatedUser.name,
          role: 'ADMIN',
          userId: authenticatedUser.id,
        },
      ],
      name: 'Platform',
      role: 'ADMIN',
      updatedAt: '2026-08-30T08:20:00.000Z',
    };
    const project = {
      createdAt: '2026-08-30T09:30:00.000Z',
      createdBy: { id: authenticatedUser.id, name: authenticatedUser.name },
      description: 'Customer-facing project',
      id: '78027a0c-c1ef-4633-900c-f797e3376673',
      name: 'Customer portal',
      teamId: team.id,
      teamName: team.name,
      teamRole: 'ADMIN',
      updatedAt: '2026-08-30T09:30:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: authenticatedUser }))
      .mockResolvedValueOnce(jsonResponse({ teams: [team] }))
      .mockResolvedValueOnce(jsonResponse({ team }))
      .mockResolvedValueOnce(jsonResponse({ projects: [] }))
      .mockResolvedValueOnce(jsonResponse({ project }))
      .mockResolvedValueOnce(jsonResponse({ tasks: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderApp('/projects');

    await user.type(
      await screen.findByLabelText('Project name'),
      'Customer portal',
    );
    await user.type(
      screen.getByLabelText('Description'),
      'Customer-facing project',
    );
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(
      await screen.findByRole('button', { name: /Customer portal/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Members' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/projects$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates a task inside a selected project', async () => {
    const team = {
      createdAt: '2026-08-30T08:20:00.000Z',
      createdBy: { id: authenticatedUser.id, name: authenticatedUser.name },
      id: '3cb79f02-b617-4f61-ac60-a56ee4998b53',
      memberCount: 1,
      members: [
        {
          email: authenticatedUser.email,
          joinedAt: '2026-08-30T08:20:00.000Z',
          name: authenticatedUser.name,
          role: 'ADMIN',
          userId: authenticatedUser.id,
        },
      ],
      name: 'Platform',
      role: 'ADMIN',
      updatedAt: '2026-08-30T08:20:00.000Z',
    };
    const project = {
      createdAt: '2026-08-30T09:30:00.000Z',
      createdBy: { id: authenticatedUser.id, name: authenticatedUser.name },
      description: 'Customer-facing project',
      id: '78027a0c-c1ef-4633-900c-f797e3376673',
      name: 'Customer portal',
      teamId: team.id,
      teamName: team.name,
      teamRole: 'ADMIN',
      updatedAt: '2026-08-30T09:30:00.000Z',
    };
    const task = {
      assignee: null,
      createdAt: '2026-08-30T10:00:00.000Z',
      description: 'Implement the endpoint',
      dueDate: null,
      id: 'e24d5e29-1bfb-4436-8633-28ea9727b329',
      labels: ['backend'],
      priority: 'HIGH',
      projectId: project.id,
      projectName: project.name,
      reporter: { id: authenticatedUser.id, name: authenticatedUser.name },
      status: 'BACKLOG',
      taskKey: 'TASK-100',
      teamRole: 'ADMIN',
      title: 'Implement payment API',
      type: 'TASK',
      updatedAt: '2026-08-30T10:00:00.000Z',
    };
    const comment = {
      author: { id: authenticatedUser.id, name: authenticatedUser.name },
      content: 'Ready for review.',
      createdAt: '2026-08-30T10:05:00.000Z',
      id: 'ef9eb80d-8dd1-4f0f-b4eb-bcbfd2f9f204',
      updatedAt: '2026-08-30T10:05:00.000Z',
    };
    const createdActivity = {
      action: 'TASK_CREATED',
      actor: { id: authenticatedUser.id, name: authenticatedUser.name },
      createdAt: task.createdAt,
      id: 'c22168c8-4ea1-4c3b-be20-94e5524aeb0f',
      metadata: { title: task.title },
    };
    const statusActivity = {
      action: 'STATUS_CHANGED',
      actor: { id: authenticatedUser.id, name: authenticatedUser.name },
      createdAt: '2026-08-30T10:06:00.000Z',
      id: '6fb0ff0f-041d-41d7-b814-a61541081515',
      metadata: { from: 'BACKLOG', to: 'TODO' },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: authenticatedUser }))
      .mockResolvedValueOnce(jsonResponse({ teams: [team] }))
      .mockResolvedValueOnce(jsonResponse({ team }))
      .mockResolvedValueOnce(jsonResponse({ projects: [project] }))
      .mockResolvedValueOnce(jsonResponse({ project }))
      .mockResolvedValueOnce(jsonResponse({ tasks: [] }))
      .mockResolvedValueOnce(jsonResponse({ task }))
      .mockResolvedValueOnce(jsonResponse({ comments: [] }))
      .mockResolvedValueOnce(jsonResponse({ activities: [createdActivity] }))
      .mockResolvedValueOnce(jsonResponse({ comment }))
      .mockResolvedValueOnce(
        jsonResponse({ task: { ...task, status: 'TODO' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ comments: [comment] }))
      .mockResolvedValueOnce(
        jsonResponse({ activities: [statusActivity, createdActivity] }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderApp('/board');

    await user.type(await screen.findByLabelText('Task title'), task.title);
    expect(screen.getByText('Active project')).toBeInTheDocument();
    expect(screen.queryByLabelText('New team')).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Task description'),
      task.description,
    );
    await user.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await user.type(screen.getByLabelText('Labels'), 'backend');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const taskCard = await screen.findByRole('button', {
      name: 'TASK-100 Implement payment API',
    });
    expect(screen.getByText('TASK-100')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks$/),
      expect.objectContaining({ method: 'POST' }),
    );

    expect(
      await screen.findByText('Balaji Ravi created this task'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add comment'), comment.content);
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(await screen.findByText(comment.content)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks\/[^/]+\/comments$/),
      expect.objectContaining({ method: 'POST' }),
    );

    fireEvent.dragStart(taskCard);
    fireEvent.drop(screen.getByRole('region', { name: 'Todo column' }));

    expect(
      await within(
        screen.getByRole('region', { name: 'Todo column' }),
      ).findByRole('button', { name: 'TASK-100 Implement payment API' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks\/[^/]+\/status$/),
      expect.objectContaining({ body: JSON.stringify({ status: 'TODO' }) }),
    );
  });
});
