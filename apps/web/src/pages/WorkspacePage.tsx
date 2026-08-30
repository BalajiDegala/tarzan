import type { TeamDetails, TeamRole, TeamSummary } from '@tarzan/types';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { teamsApi } from '../lib/api';

function asSummary(team: TeamDetails): TeamSummary {
  return {
    createdAt: team.createdAt,
    id: team.id,
    memberCount: team.memberCount,
    name: team.name,
    role: team.role,
    updatedAt: team.updatedAt,
  };
}

export function WorkspacePage() {
  const { logout, user } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetails | null>(null);
  const [teamName, setTeamName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<TeamRole>('MEMBER');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void teamsApi
      .list()
      .then(async ({ teams: availableTeams }) => {
        if (!active) {
          return;
        }

        setTeams(availableTeams);

        const firstTeam = availableTeams[0];
        if (firstTeam !== undefined) {
          const { team } = await teamsApi.get(firstTeam.id);
          if (active) {
            setSelectedTeam(team);
          }
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load your teams.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (user === null) {
    return null;
  }

  async function handleLogout() {
    setSigningOut(true);
    await logout();
  }

  async function handleCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    try {
      const { team } = await teamsApi.create({ name: teamName });
      setTeams((current) => [asSummary(team), ...current]);
      setSelectedTeam(team);
      setTeamName('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the team.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleSelectTeam(teamId: string) {
    setWorking(true);
    setError(null);

    try {
      const { team } = await teamsApi.get(teamId);
      setSelectedTeam(team);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load the team.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedTeam === null) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const { member } = await teamsApi.addMember(selectedTeam.id, {
        email: memberEmail,
        role: memberRole,
      });
      const memberCount = selectedTeam.memberCount + 1;
      setSelectedTeam({
        ...selectedTeam,
        memberCount,
        members: [...selectedTeam.members, member],
      });
      setTeams((current) =>
        current.map((team) =>
          team.id === selectedTeam.id ? { ...team, memberCount } : team,
        ),
      );
      setMemberEmail('');
      setMemberRole('MEMBER');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to add this member.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (selectedTeam === null) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      await teamsApi.removeMember(selectedTeam.id, userId);
      const memberCount = selectedTeam.memberCount - 1;
      setSelectedTeam({
        ...selectedTeam,
        memberCount,
        members: selectedTeam.members.filter(
          (member) => member.userId !== userId,
        ),
      });
      setTeams((current) =>
        current.map((team) =>
          team.id === selectedTeam.id ? { ...team, memberCount } : team,
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to remove this member.',
      );
    } finally {
      setWorking(false);
    }
  }

  const firstName = user.name.split(' ')[0] || user.name;
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#f4f5ef] text-[#102018]">
      <header className="border-b border-emerald-950/10 bg-[#07130f] text-stone-100">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Brand />
            <span className="hidden rounded-lg bg-white/5 px-3 py-2 text-sm font-bold text-lime-200 sm:inline-flex">
              Teams
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-stone-400">{user.email}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-lime-300 text-sm font-black text-[#07130f]">
              {initials}
            </span>
            <button
              className="ml-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-stone-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-60"
              disabled={signingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
        <div className="mb-10">
          <p className="text-sm font-black tracking-[0.16em] text-emerald-700 uppercase">
            Team management
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Welcome, {firstName}.
          </h1>
          <p className="mt-3 text-lg text-emerald-950/60">
            Create a team, add registered members, and decide who can administer
            it.
          </p>
        </div>

        {error === null ? null : (
          <div
            className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-900/10 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
            role="alert"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              type="button"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="space-y-5">
            <form
              className="rounded-[1.5rem] bg-[#0c251b] p-5 text-stone-100 shadow-lg shadow-emerald-950/10"
              onSubmit={handleCreateTeam}
            >
              <label className="text-xs font-black tracking-[0.14em] text-lime-300 uppercase">
                New team
                <input
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-stone-500 focus:border-lime-300"
                  maxLength={100}
                  minLength={2}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="e.g. Platform"
                  required
                  type="text"
                  value={teamName}
                />
              </label>
              <button
                className="mt-3 w-full rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-[#07130f] transition hover:bg-lime-200 disabled:opacity-60"
                disabled={working}
                type="submit"
              >
                Create team
              </button>
            </form>

            <div className="overflow-hidden rounded-[1.5rem] border border-emerald-950/10 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-emerald-950/10 px-5 py-4">
                <h2 className="font-black">Your teams</h2>
                <span className="rounded-full bg-emerald-950/5 px-2.5 py-1 text-xs font-black text-emerald-800">
                  {teams.length}
                </span>
              </div>

              {loading ? (
                <p className="px-5 py-6 text-sm text-emerald-950/50">
                  Loading teams…
                </p>
              ) : teams.length === 0 ? (
                <p className="px-5 py-6 text-sm leading-6 text-emerald-950/50">
                  No teams yet. Create your first one above.
                </p>
              ) : (
                <ul className="divide-y divide-emerald-950/10">
                  {teams.map((team) => (
                    <li key={team.id}>
                      <button
                        className={`w-full px-5 py-4 text-left transition ${
                          selectedTeam?.id === team.id
                            ? 'bg-lime-100/70'
                            : 'hover:bg-emerald-950/[0.025]'
                        }`}
                        disabled={working}
                        onClick={() => void handleSelectTeam(team.id)}
                        type="button"
                      >
                        <span className="block font-black">{team.name}</span>
                        <span className="mt-1 block text-xs font-semibold text-emerald-950/45">
                          {team.memberCount}{' '}
                          {team.memberCount === 1 ? 'member' : 'members'} ·{' '}
                          {team.role.toLowerCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <TeamPanel
            memberEmail={memberEmail}
            memberRole={memberRole}
            onAddMember={handleAddMember}
            onEmailChange={setMemberEmail}
            onRemoveMember={handleRemoveMember}
            onRoleChange={setMemberRole}
            team={selectedTeam}
            working={working}
          />
        </div>
      </section>
    </main>
  );
}

interface TeamPanelProps {
  memberEmail: string;
  memberRole: TeamRole;
  onAddMember(event: React.FormEvent<HTMLFormElement>): Promise<void>;
  onEmailChange(value: string): void;
  onRemoveMember(userId: string): Promise<void>;
  onRoleChange(value: TeamRole): void;
  team: TeamDetails | null;
  working: boolean;
}

function TeamPanel({
  memberEmail,
  memberRole,
  onAddMember,
  onEmailChange,
  onRemoveMember,
  onRoleChange,
  team,
  working,
}: TeamPanelProps) {
  if (team === null) {
    return (
      <div className="grid min-h-96 place-items-center rounded-[2rem] border border-dashed border-emerald-950/15 bg-white/50 p-8 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-950/5 text-2xl">
            +
          </span>
          <h2 className="mt-5 text-2xl font-black">
            Your first team starts here.
          </h2>
          <p className="mt-2 text-emerald-950/50">
            Create a team to begin managing its members.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = team.role === 'ADMIN';
  const adminCount = team.members.filter(
    (member) => member.role === 'ADMIN',
  ).length;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-sm">
      <div className="bg-[#0c251b] px-7 py-7 text-stone-100 sm:px-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="text-xs font-black tracking-[0.14em] text-lime-300 uppercase">
              {team.role.toLowerCase()} access
            </span>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">
              {team.name}
            </h2>
            <p className="mt-2 text-sm text-stone-400">
              Created by {team.createdBy.name} · {team.memberCount}{' '}
              {team.memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-stone-300">
            Team
          </span>
        </div>
      </div>

      {isAdmin ? (
        <form
          className="grid gap-3 border-b border-emerald-950/10 bg-lime-50/60 px-7 py-5 sm:grid-cols-[1fr_9rem_auto] sm:px-9"
          onSubmit={(event) => void onAddMember(event)}
        >
          <label className="sr-only" htmlFor="member-email">
            Member email
          </label>
          <input
            className="rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium outline-none transition placeholder:text-emerald-950/35 focus:border-emerald-700"
            id="member-email"
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="member@company.com"
            required
            type="email"
            value={memberEmail}
          />
          <label className="sr-only" htmlFor="member-role">
            Team role
          </label>
          <select
            className="rounded-xl border border-emerald-950/10 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-emerald-700"
            id="member-role"
            onChange={(event) => onRoleChange(event.target.value as TeamRole)}
            value={memberRole}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
            disabled={working}
            type="submit"
          >
            Add member
          </button>
        </form>
      ) : null}

      <div className="px-7 py-7 sm:px-9">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-black">Members</h3>
          {!isAdmin ? (
            <span className="text-xs font-semibold text-emerald-950/45">
              View only
            </span>
          ) : null}
        </div>
        <ul className="divide-y divide-emerald-950/10">
          {team.members.map((member) => {
            const isSoleAdmin = member.role === 'ADMIN' && adminCount === 1;
            const initials = member.name
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase();

            return (
              <li className="flex items-center gap-4 py-4" key={member.userId}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-950/5 text-xs font-black text-emerald-900">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{member.name}</p>
                  <p className="truncate text-xs text-emerald-950/45">
                    {member.email}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-950/5 px-3 py-1 text-xs font-black text-emerald-800 capitalize">
                  {member.role.toLowerCase()}
                </span>
                {isAdmin ? (
                  <button
                    className="rounded-lg px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    disabled={working || isSoleAdmin}
                    onClick={() => void onRemoveMember(member.userId)}
                    title={
                      isSoleAdmin
                        ? 'A team must always have an admin'
                        : undefined
                    }
                    type="button"
                  >
                    {isSoleAdmin ? 'Sole admin' : 'Remove'}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
