import type {
  ProjectDetails,
  ProjectSummary,
  TeamDetails,
  TeamRole,
  TeamSummary,
} from '@tarzan/types';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { projectsApi, teamsApi } from '../lib/api';
import { TaskWorkspace } from './TaskWorkspace';

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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectDetails | null>(
    null,
  );
  const [teamName, setTeamName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
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
            const projectResponse = await projectsApi.list(team.id);
            if (active) {
              setProjects(projectResponse.projects);

              const firstProject = projectResponse.projects[0];
              if (firstProject !== undefined) {
                const { project } = await projectsApi.get(firstProject.id);
                if (active) {
                  setSelectedProject(project);
                  setEditProjectName(project.name);
                  setEditProjectDescription(project.description ?? '');
                }
              }
            }
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
      setProjects([]);
      setSelectedProject(null);
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
      const { projects: teamProjects } = await projectsApi.list(teamId);
      setSelectedTeam(team);
      setProjects(teamProjects);

      const firstProject = teamProjects[0];
      if (firstProject === undefined) {
        setSelectedProject(null);
        setEditProjectName('');
        setEditProjectDescription('');
      } else {
        const { project } = await projectsApi.get(firstProject.id);
        setSelectedProject(project);
        setEditProjectName(project.name);
        setEditProjectDescription(project.description ?? '');
      }
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

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedTeam === null) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const { project } = await projectsApi.create({
        description: projectDescription,
        name: projectName,
        teamId: selectedTeam.id,
      });
      setProjects((current) => [project, ...current]);
      setSelectedProject(project);
      setEditProjectName(project.name);
      setEditProjectDescription(project.description ?? '');
      setProjectName('');
      setProjectDescription('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the project.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleSelectProject(projectId: string) {
    setWorking(true);
    setError(null);

    try {
      const { project } = await projectsApi.get(projectId);
      setSelectedProject(project);
      setEditProjectName(project.name);
      setEditProjectDescription(project.description ?? '');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load the project.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleUpdateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedProject === null) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const { project } = await projectsApi.update(selectedProject.id, {
        description: editProjectDescription,
        name: editProjectName,
      });
      setSelectedProject(project);
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? project : item)),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to update the project.',
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
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-5 sm:gap-8">
            <Brand />
            <nav
              aria-label="Workspace sections"
              className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1"
            >
              {[
                ['Teams', '#teams'],
                ['Projects', '#projects'],
                ['Board', '#board'],
              ].map(([label, href]) => (
                <a
                  className="rounded-lg px-3 py-2 text-xs font-black text-stone-300 transition hover:bg-white/10 hover:text-lime-200 sm:text-sm"
                  href={href}
                  key={href}
                >
                  {label}
                </a>
              ))}
            </nav>
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
            Workspace overview
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Your work, {firstName}.
          </h1>
          <p className="mt-3 text-lg text-emerald-950/60">
            Move directly between your teams, projects, and delivery board.
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
          <aside className="scroll-mt-6 space-y-5" id="teams">
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
            editProjectDescription={editProjectDescription}
            editProjectName={editProjectName}
            memberEmail={memberEmail}
            memberRole={memberRole}
            onAddMember={handleAddMember}
            onCreateProject={handleCreateProject}
            onEmailChange={setMemberEmail}
            onEditProjectDescriptionChange={setEditProjectDescription}
            onEditProjectNameChange={setEditProjectName}
            onRemoveMember={handleRemoveMember}
            onRoleChange={setMemberRole}
            onSelectProject={handleSelectProject}
            onUpdateProject={handleUpdateProject}
            projectDescription={projectDescription}
            projectName={projectName}
            projects={projects}
            selectedProject={selectedProject}
            currentUserId={user.id}
            onProjectDescriptionChange={setProjectDescription}
            onProjectNameChange={setProjectName}
            team={selectedTeam}
            working={working}
          />
        </div>
      </section>
    </main>
  );
}

interface TeamPanelProps {
  currentUserId: string;
  editProjectDescription: string;
  editProjectName: string;
  memberEmail: string;
  memberRole: TeamRole;
  onAddMember(event: React.FormEvent<HTMLFormElement>): Promise<void>;
  onCreateProject(event: React.FormEvent<HTMLFormElement>): Promise<void>;
  onEmailChange(value: string): void;
  onEditProjectDescriptionChange(value: string): void;
  onEditProjectNameChange(value: string): void;
  onProjectDescriptionChange(value: string): void;
  onProjectNameChange(value: string): void;
  onRemoveMember(userId: string): Promise<void>;
  onRoleChange(value: TeamRole): void;
  onSelectProject(projectId: string): Promise<void>;
  onUpdateProject(event: React.FormEvent<HTMLFormElement>): Promise<void>;
  projectDescription: string;
  projectName: string;
  projects: ProjectSummary[];
  selectedProject: ProjectDetails | null;
  team: TeamDetails | null;
  working: boolean;
}

function TeamPanel({
  currentUserId,
  editProjectDescription,
  editProjectName,
  memberEmail,
  memberRole,
  onAddMember,
  onCreateProject,
  onEmailChange,
  onEditProjectDescriptionChange,
  onEditProjectNameChange,
  onProjectDescriptionChange,
  onProjectNameChange,
  onRemoveMember,
  onRoleChange,
  onSelectProject,
  onUpdateProject,
  projectDescription,
  projectName,
  projects,
  selectedProject,
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

      <div
        className="scroll-mt-6 border-b border-emerald-950/10 px-7 py-7 sm:px-9"
        id="projects"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.14em] text-emerald-700 uppercase">
              Projects
            </p>
            <h3 className="mt-1 text-xl font-black">Team workspaces</h3>
          </div>
          <span className="rounded-full bg-emerald-950/5 px-3 py-1 text-xs font-black text-emerald-800">
            {projects.length}
          </span>
        </div>

        {isAdmin ? (
          <form
            className="mb-6 grid gap-3 rounded-2xl bg-lime-50/70 p-4 sm:grid-cols-2"
            onSubmit={(event) => void onCreateProject(event)}
          >
            <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
              Project name
              <input
                className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                maxLength={100}
                minLength={2}
                onChange={(event) => onProjectNameChange(event.target.value)}
                placeholder="e.g. Customer portal"
                required
                value={projectName}
              />
            </label>
            <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
              Description
              <input
                className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                maxLength={5000}
                onChange={(event) =>
                  onProjectDescriptionChange(event.target.value)
                }
                placeholder="What is this project for?"
                value={projectDescription}
              />
            </label>
            <button
              className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60 sm:col-span-2"
              disabled={working}
              type="submit"
            >
              Create project
            </button>
          </form>
        ) : (
          <p className="mb-5 text-sm text-emerald-950/50">
            Projects are view only for team members.
          </p>
        )}

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-950/15 px-5 py-8 text-center text-sm text-emerald-950/50">
            No projects in this team yet.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <ul className="space-y-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedProject?.id === project.id
                        ? 'border-emerald-800 bg-emerald-50'
                        : 'border-emerald-950/10 hover:bg-emerald-950/[0.025]'
                    }`}
                    disabled={working}
                    onClick={() => void onSelectProject(project.id)}
                    type="button"
                  >
                    <span className="block text-sm font-black">
                      {project.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-emerald-950/45">
                      {project.description ?? 'No description'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selectedProject === null ? (
              <div className="grid min-h-36 place-items-center rounded-2xl bg-emerald-950/[0.025] p-5 text-center text-sm text-emerald-950/45">
                Select a project to see its details.
              </div>
            ) : isAdmin ? (
              <form
                className="rounded-2xl border border-emerald-950/10 p-4"
                onSubmit={(event) => void onUpdateProject(event)}
              >
                <p className="mb-4 text-xs font-semibold text-emerald-950/45">
                  Created by {selectedProject.createdBy.name}
                </p>
                <label className="block text-xs font-black tracking-wide text-emerald-900 uppercase">
                  Project name
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) =>
                      onEditProjectNameChange(event.target.value)
                    }
                    required
                    value={editProjectName}
                  />
                </label>
                <label className="mt-3 block text-xs font-black tracking-wide text-emerald-900 uppercase">
                  Description
                  <textarea
                    className="mt-2 min-h-24 w-full resize-y rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                    maxLength={5000}
                    onChange={(event) =>
                      onEditProjectDescriptionChange(event.target.value)
                    }
                    value={editProjectDescription}
                  />
                </label>
                <button
                  className="mt-3 w-full rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                  disabled={working}
                  type="submit"
                >
                  Save project
                </button>
              </form>
            ) : (
              <article className="rounded-2xl border border-emerald-950/10 p-5">
                <p className="text-xs font-black tracking-wide text-emerald-700 uppercase">
                  Project details
                </p>
                <h4 className="mt-2 text-xl font-black">
                  {selectedProject.name}
                </h4>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-emerald-950/60">
                  {selectedProject.description ?? 'No description provided.'}
                </p>
                <p className="mt-5 text-xs text-emerald-950/45">
                  Created by {selectedProject.createdBy.name}
                </p>
              </article>
            )}
          </div>
        )}

        {selectedProject === null ? null : (
          <a
            className="mt-5 inline-flex rounded-xl bg-emerald-950/5 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-950/10"
            href="#board"
          >
            Open {selectedProject.name} board ↓
          </a>
        )}
      </div>

      <div className="scroll-mt-6 px-7 pb-7 sm:px-9 sm:pb-9" id="board">
        {selectedProject === null ? (
          <div className="mt-7 rounded-2xl border border-dashed border-emerald-950/15 px-5 py-10 text-center">
            <p className="text-xs font-black tracking-[0.14em] text-emerald-700 uppercase">
              Delivery board
            </p>
            <h3 className="mt-2 text-xl font-black">Select a project first</h3>
            <p className="mt-2 text-sm text-emerald-950/50">
              Create or select a project above to open its task board.
            </p>
          </div>
        ) : (
          <TaskWorkspace
            currentUserId={currentUserId}
            key={selectedProject.id}
            members={team.members}
            project={selectedProject}
          />
        )}
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
