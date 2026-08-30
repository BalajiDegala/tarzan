import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TaskWorkspace } from './TaskWorkspace';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TaskWorkspace filters', () => {
  it('sends key/title search and all task filters to the API', async () => {
    const currentUserId = 'd53da168-40e6-40c8-85c1-47cc261ef4b8';
    const memberId = 'f3a2f768-8399-4dd8-96ca-784b445f097d';
    const project = {
      createdAt: '2026-08-30T09:30:00.000Z',
      createdBy: { id: currentUserId, name: 'Balaji Ravi' },
      description: null,
      id: '78027a0c-c1ef-4633-900c-f797e3376673',
      name: 'Customer portal',
      teamId: '3cb79f02-b617-4f61-ac60-a56ee4998b53',
      teamName: 'Platform',
      teamRole: 'ADMIN' as const,
      updatedAt: '2026-08-30T09:30:00.000Z',
    };
    const members = [
      {
        email: 'member@example.com',
        joinedAt: '2026-08-30T08:20:00.000Z',
        name: 'Team Member',
        role: 'MEMBER' as const,
        userId: memberId,
      },
    ];
    const task = {
      assignee: { id: memberId, name: 'Team Member' },
      createdAt: '2026-08-30T10:00:00.000Z',
      dueDate: null,
      id: 'e24d5e29-1bfb-4436-8633-28ea9727b329',
      priority: 'HIGH' as const,
      projectId: project.id,
      projectName: project.name,
      reporter: { id: currentUserId, name: 'Balaji Ravi' },
      status: 'IN_PROGRESS' as const,
      taskKey: 'TASK-100',
      teamRole: 'ADMIN' as const,
      title: 'Implement payment API',
      type: 'STORY' as const,
      updatedAt: '2026-08-30T10:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tasks: [task] }))
      .mockResolvedValueOnce(jsonResponse({ tasks: [task] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <TaskWorkspace
        currentUserId={currentUserId}
        members={members}
        project={project}
      />,
    );

    expect(
      await screen.findByRole('button', {
        name: 'TASK-100 Implement payment API',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.type(screen.getByLabelText('Search tasks'), 'payment');
    await user.selectOptions(
      screen.getByLabelText('Filter status'),
      'IN_PROGRESS',
    );
    await user.selectOptions(screen.getByLabelText('Filter priority'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Filter type'), 'STORY');
    await user.selectOptions(
      screen.getByLabelText('Filter assignee'),
      memberId,
    );
    await user.type(screen.getByLabelText('Filter label'), 'backend');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const requestUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(requestUrl.searchParams.get('projectId')).toBe(project.id);
    expect(requestUrl.searchParams.get('search')).toBe('payment');
    expect(requestUrl.searchParams.get('status')).toBe('IN_PROGRESS');
    expect(requestUrl.searchParams.get('priority')).toBe('HIGH');
    expect(requestUrl.searchParams.get('type')).toBe('STORY');
    expect(requestUrl.searchParams.get('assigneeId')).toBe(memberId);
    expect(requestUrl.searchParams.get('label')).toBe('backend');
  });
});
