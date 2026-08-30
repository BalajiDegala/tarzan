import type {
  ProjectDetails,
  TaskDetails,
  TaskFilters,
  TaskPriority,
  TaskStatus,
  TaskSummary,
  TaskType,
  TeamMemberDetails,
} from '@tarzan/types';
import { useEffect, useState } from 'react';

import { tasksApi } from '../lib/api';
import { KanbanBoard } from './KanbanBoard';
import { TaskCollaboration } from './TaskCollaboration';

const taskTypes: TaskType[] = ['TASK', 'BUG', 'STORY'];
const taskPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const taskStatuses: TaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'BLOCKED',
];

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function labelsFromInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((label) => label.trim())
        .filter((label) => label.length > 0),
    ),
  ];
}

interface TaskWorkspaceProps {
  currentUserId: string;
  members: TeamMemberDetails[];
  project: ProjectDetails;
}

export function TaskWorkspace({
  currentUserId,
  members,
  project,
}: TaskWorkspaceProps) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskDetails | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('TASK');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [labels, setLabels] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TaskType>('TASK');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editDueDate, setEditDueDate] = useState('');
  const [editLabels, setEditLabels] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'BOARD' | 'LIST'>('BOARD');
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [collaborationVersion, setCollaborationVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [filterType, setFilterType] = useState<TaskType | ''>('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<TaskFilters>({});

  const isAdmin = project.teamRole === 'ADMIN';

  useEffect(() => {
    let active = true;

    void tasksApi
      .list({ projectId: project.id, ...appliedFilters })
      .then(({ tasks: projectTasks }) => {
        if (active) {
          setTasks(projectTasks);
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load tasks.',
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
  }, [appliedFilters, project.id]);

  function handleApplyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      ...(filterAssignee.length === 0 ? {} : { assigneeId: filterAssignee }),
      ...(filterLabel.trim().length === 0 ? {} : { label: filterLabel.trim() }),
      ...(filterPriority === '' ? {} : { priority: filterPriority }),
      ...(search.trim().length === 0 ? {} : { search: search.trim() }),
      ...(filterStatus === '' ? {} : { status: filterStatus }),
      ...(filterType === '' ? {} : { type: filterType }),
    });
  }

  function handleClearFilters() {
    setSearch('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterType('');
    setFilterAssignee('');
    setFilterLabel('');
    setAppliedFilters({});
  }

  function populateEditor(task: TaskDetails) {
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditType(task.type);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate ?? '');
    setEditLabels(task.labels.join(', '));
  }

  function replaceTask(task: TaskDetails) {
    setSelectedTask(task);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? task : item)),
    );
    populateEditor(task);
    setCollaborationVersion((current) => current + 1);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    try {
      const { task } = await tasksApi.create({
        ...(isAdmin && assigneeId.length > 0 ? { assigneeId } : {}),
        description,
        ...(dueDate.length > 0 ? { dueDate } : {}),
        labels: labelsFromInput(labels),
        priority,
        projectId: project.id,
        title,
        type,
      });
      setTasks((current) => [task, ...current]);
      setSelectedTask(task);
      populateEditor(task);
      setTitle('');
      setDescription('');
      setType('TASK');
      setPriority('MEDIUM');
      setDueDate('');
      setLabels('');
      setAssigneeId('');
      setShowCreate(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the task.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleSelect(taskId: string) {
    setWorking(true);
    setError(null);

    try {
      const { task } = await tasksApi.get(taskId);
      setSelectedTask(task);
      populateEditor(task);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load the task.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTask === null) return;
    setWorking(true);
    setError(null);

    try {
      const { task } = await tasksApi.update(selectedTask.id, {
        description: editDescription,
        dueDate: editDueDate.length === 0 ? null : editDueDate,
        labels: labelsFromInput(editLabels),
        priority: editPriority,
        title: editTitle,
        type: editType,
      });
      replaceTask(task);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to update the task.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleStatus(status: TaskStatus) {
    if (selectedTask === null) return;
    setWorking(true);
    setError(null);

    try {
      const { task } = await tasksApi.updateStatus(selectedTask.id, status);
      replaceTask(task);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to update task status.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleBoardMove(taskId: string, status: TaskStatus) {
    setWorking(true);
    setError(null);

    try {
      const { task } = await tasksApi.updateStatus(taskId, status);
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? task : item)),
      );
      if (selectedTask?.id === task.id) {
        setSelectedTask(task);
        populateEditor(task);
        setCollaborationVersion((current) => current + 1);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to move the task.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleAssignee(nextAssigneeId: string) {
    if (selectedTask === null) return;
    setWorking(true);
    setError(null);

    try {
      const { task } = await tasksApi.updateAssignee(
        selectedTask.id,
        nextAssigneeId.length === 0 ? null : nextAssigneeId,
      );
      replaceTask(task);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to assign the task.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (
      selectedTask === null ||
      !window.confirm(
        `Delete ${selectedTask.taskKey} "${selectedTask.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setWorking(true);
    setError(null);

    try {
      await tasksApi.remove(selectedTask.id);
      setTasks((current) =>
        current.filter((task) => task.id !== selectedTask.id),
      );
      setSelectedTask(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to delete the task.',
      );
    } finally {
      setWorking(false);
    }
  }

  const canEdit =
    selectedTask !== null &&
    (isAdmin ||
      selectedTask.reporter.id === currentUserId ||
      selectedTask.assignee?.id === currentUserId);

  function canMove(task: TaskSummary): boolean {
    return (
      task.teamRole === 'ADMIN' ||
      task.reporter.id === currentUserId ||
      task.assignee?.id === currentUserId
    );
  }

  return (
    <section className="mt-7 border-t border-emerald-950/10 pt-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-xs font-black tracking-[0.14em] text-emerald-700 uppercase">
            Project workflow
          </p>
          <h3 className="mt-1 text-2xl font-black">{project.name}</h3>
          <p className="mt-1 text-sm text-emerald-950/50">
            Drag cards between columns, or select a task to see its details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-expanded={showFilters}
            className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${
              showFilters
                ? 'border-emerald-800 bg-emerald-50 text-emerald-900'
                : 'border-emerald-950/10 bg-white text-emerald-800 hover:bg-emerald-50'
            }`}
            onClick={() => setShowFilters((current) => !current)}
            type="button"
          >
            Filters
            {Object.keys(appliedFilters).length === 0 ? null : (
              <span className="ml-2 rounded-full bg-emerald-800 px-2 py-0.5 text-[0.65rem] text-white">
                {Object.keys(appliedFilters).length}
              </span>
            )}
          </button>
          <button
            aria-expanded={showCreate}
            className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
            onClick={() => setShowCreate((current) => !current)}
            type="button"
          >
            {showCreate ? 'Close form' : 'New task'}
          </button>
          <div className="flex rounded-xl bg-emerald-950/5 p-1">
            {(['BOARD', 'LIST'] as const).map((option) => (
              <button
                aria-pressed={view === option}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                  view === option
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-emerald-950/45'
                }`}
                key={option}
                onClick={() => setView(option)}
                type="button"
              >
                {option === 'BOARD' ? 'Board' : 'List'}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-emerald-950/5 px-3 py-2 text-xs font-black text-emerald-800">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      </div>

      {error === null ? null : (
        <p
          className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {showFilters ? (
        <form
          aria-label="Task filters"
          className="mb-6 grid gap-4 rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-6"
          onSubmit={handleApplyFilters}
        >
          <div className="sm:col-span-2 xl:col-span-6">
            <h4 className="text-lg font-black">Filter this board</h4>
            <p className="mt-1 text-sm text-emerald-950/50">
              Narrow the board without changing any task data.
            </p>
          </div>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase xl:col-span-2">
            Search tasks
            <input
              className="mt-2 w-full rounded-xl border border-emerald-950/10 px-3 py-2.5 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              maxLength={200}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Task key or title"
              value={search}
            />
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Filter status
            <select
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-emerald-700"
              onChange={(event) =>
                setFilterStatus(event.target.value as TaskStatus | '')
              }
              value={filterStatus}
            >
              <option value="">All statuses</option>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {readable(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Filter priority
            <select
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-emerald-700"
              onChange={(event) =>
                setFilterPriority(event.target.value as TaskPriority | '')
              }
              value={filterPriority}
            >
              <option value="">All priorities</option>
              {taskPriorities.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Filter type
            <select
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-emerald-700"
              onChange={(event) =>
                setFilterType(event.target.value as TaskType | '')
              }
              value={filterType}
            >
              <option value="">All types</option>
              {taskTypes.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Filter assignee
            <select
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm font-bold normal-case outline-none focus:border-emerald-700"
              onChange={(event) => setFilterAssignee(event.target.value)}
              value={filterAssignee}
            >
              <option value="">All assignees</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase xl:col-span-2">
            Filter label
            <input
              className="mt-2 w-full rounded-xl border border-emerald-950/10 px-3 py-2.5 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              maxLength={50}
              onChange={(event) => setFilterLabel(event.target.value)}
              placeholder="e.g. backend"
              value={filterLabel}
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4">
            <button
              className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-black text-white"
              type="submit"
            >
              Apply filters
            </button>
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-black text-emerald-800 hover:bg-emerald-50"
              onClick={handleClearFilters}
              type="button"
            >
              Clear
            </button>
          </div>
        </form>
      ) : null}

      {showCreate ? (
        <form
          aria-label="Create task"
          className="mb-6 grid gap-4 rounded-2xl border border-lime-300/60 bg-lime-50/70 p-5 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => void handleCreate(event)}
        >
          <div className="sm:col-span-2 xl:col-span-4">
            <h4 className="text-lg font-black">Create a task</h4>
            <p className="mt-1 text-sm text-emerald-950/50">
              New tasks start in Backlog and can be moved when they are ready.
            </p>
          </div>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase sm:col-span-2 xl:col-span-2">
            Task title
            <input
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              maxLength={200}
              minLength={2}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to be done?"
              required
              value={title}
            />
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase sm:col-span-2 xl:col-span-2">
            Task description
            <textarea
              className="mt-2 min-h-20 w-full resize-y rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              maxLength={10000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add useful context"
              value={description}
            />
          </label>
          <TaskSelect<TaskType>
            label="Type"
            onChange={setType}
            options={taskTypes}
            value={type}
          />
          <TaskSelect<TaskPriority>
            label="Priority"
            onChange={setPriority}
            options={taskPriorities}
            value={priority}
          />
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Due date
            <input
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Labels
            <input
              className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              onChange={(event) => setLabels(event.target.value)}
              placeholder="backend, api"
              value={labels}
            />
          </label>
          {isAdmin ? (
            <label className="text-xs font-black tracking-wide text-emerald-900 uppercase sm:col-span-2 xl:col-span-3">
              Assignee
              <select
                className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-bold normal-case outline-none focus:border-emerald-700"
                onChange={(event) => setAssigneeId(event.target.value)}
                value={assigneeId}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className={`rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60 ${
              isAdmin
                ? 'sm:col-span-2 xl:col-span-1'
                : 'sm:col-span-2 xl:col-span-4'
            }`}
            disabled={working}
            type="submit"
          >
            Create task
          </button>
        </form>
      ) : null}

      <div
        className={
          view === 'LIST'
            ? 'grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'
            : 'space-y-4'
        }
      >
        {loading ? (
          <p className="text-sm text-emerald-950/50">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-950/15 px-5 py-8 text-center text-sm text-emerald-950/50">
            No tasks in this project yet.
          </div>
        ) : view === 'BOARD' ? (
          <KanbanBoard
            canMove={canMove}
            onMove={handleBoardMove}
            onSelect={handleSelect}
            selectedTaskId={selectedTask?.id ?? null}
            tasks={tasks}
            working={working}
          />
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedTask?.id === task.id
                      ? 'border-emerald-800 bg-emerald-50'
                      : 'border-emerald-950/10 hover:bg-emerald-950/[0.025]'
                  }`}
                  disabled={working}
                  onClick={() => void handleSelect(task.id)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-emerald-700">
                      {task.taskKey}
                    </span>
                    <span className="text-[0.65rem] font-black tracking-wide text-emerald-950/45 uppercase">
                      {readable(task.status)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm font-black">
                    {task.title}
                  </span>
                  <span className="mt-1 block text-xs text-emerald-950/45">
                    {readable(task.type)} · {readable(task.priority)} ·{' '}
                    {task.assignee?.name ?? 'Unassigned'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedTask === null && view === 'LIST' ? (
          <div className="grid min-h-40 place-items-center rounded-2xl bg-emerald-950/[0.025] p-5 text-center text-sm text-emerald-950/45">
            Select a task to view and update it.
          </div>
        ) : selectedTask === null ? null : (
          <article className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-emerald-700">
                  {selectedTask.taskKey}
                </p>
                <p className="mt-1 text-xs text-emerald-950/45">
                  Reported by {selectedTask.reporter.name}
                </p>
              </div>
              <span className="rounded-full bg-emerald-950/5 px-3 py-1 text-xs font-black text-emerald-800">
                {readable(selectedTask.status)}
              </span>
            </div>

            {canEdit ? (
              <form onSubmit={(event) => void handleUpdate(event)}>
                <label className="block text-xs font-black tracking-wide text-emerald-900 uppercase">
                  Task title
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                    maxLength={200}
                    minLength={2}
                    onChange={(event) => setEditTitle(event.target.value)}
                    required
                    value={editTitle}
                  />
                </label>
                <label className="mt-3 block text-xs font-black tracking-wide text-emerald-900 uppercase">
                  Description
                  <textarea
                    className="mt-2 min-h-24 w-full resize-y rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                    maxLength={10000}
                    onChange={(event) => setEditDescription(event.target.value)}
                    value={editDescription}
                  />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <TaskSelect<TaskType>
                    label="Type"
                    onChange={setEditType}
                    options={taskTypes}
                    value={editType}
                  />
                  <TaskSelect<TaskPriority>
                    label="Priority"
                    onChange={setEditPriority}
                    options={taskPriorities}
                    value={editPriority}
                  />
                  <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
                    Due date
                    <input
                      className="mt-2 w-full rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                      onChange={(event) => setEditDueDate(event.target.value)}
                      type="date"
                      value={editDueDate}
                    />
                  </label>
                  <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
                    Labels
                    <input
                      className="mt-2 w-full rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
                      onChange={(event) => setEditLabels(event.target.value)}
                      value={editLabels}
                    />
                  </label>
                </div>
                <button
                  className="mt-3 w-full rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                  disabled={working}
                  type="submit"
                >
                  Save task
                </button>
              </form>
            ) : (
              <div>
                <h4 className="text-lg font-black">{selectedTask.title}</h4>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-emerald-950/60">
                  {selectedTask.description ?? 'No description provided.'}
                </p>
              </div>
            )}

            {canEdit ? (
              <label className="mt-4 block text-xs font-black tracking-wide text-emerald-900 uppercase">
                Status
                <select
                  className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-bold normal-case outline-none focus:border-emerald-700"
                  disabled={working}
                  onChange={(event) =>
                    void handleStatus(event.target.value as TaskStatus)
                  }
                  value={selectedTask.status}
                >
                  {taskStatuses.map((status) => (
                    <option key={status} value={status}>
                      {readable(status)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {isAdmin ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
                  Assignee
                  <select
                    className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-bold normal-case outline-none focus:border-emerald-700"
                    disabled={working}
                    onChange={(event) =>
                      void handleAssignee(event.target.value)
                    }
                    value={selectedTask.assignee?.id ?? ''}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="rounded-xl px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-60"
                  disabled={working}
                  onClick={() => void handleDelete()}
                  type="button"
                >
                  Delete task
                </button>
              </div>
            ) : null}
          </article>
        )}
      </div>

      {selectedTask === null ? null : (
        <TaskCollaboration
          key={selectedTask.id}
          refreshVersion={collaborationVersion}
          taskId={selectedTask.id}
        />
      )}
    </section>
  );
}

interface TaskSelectProps<T extends string> {
  label: string;
  onChange(value: T): void;
  options: T[];
  value: T;
}

function TaskSelect<T extends string>({
  label,
  onChange,
  options,
  value,
}: TaskSelectProps<T>) {
  return (
    <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
      {label}
      <select
        className="mt-2 w-full rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-bold normal-case outline-none focus:border-emerald-700"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {readable(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
