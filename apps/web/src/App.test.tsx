import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
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
      await screen.findByRole('heading', { name: 'Welcome, Balaji.' }),
    ).toBeInTheDocument();
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

    renderApp('/');

    await user.type(await screen.findByLabelText('New team'), 'Platform');
    await user.click(screen.getByRole('button', { name: 'Create team' }));

    expect(
      await screen.findByRole('heading', { name: 'Platform' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 member · admin')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/teams$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
