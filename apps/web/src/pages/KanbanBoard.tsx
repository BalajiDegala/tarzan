import type { TaskStatus, TaskSummary } from '@tarzan/types';
import { useState } from 'react';

const columns: Array<{
  accent: string;
  description: string;
  label: string;
  status: TaskStatus;
  surface: string;
}> = [
  {
    accent: 'bg-stone-400',
    description: 'Ideas waiting to be planned',
    label: 'Backlog',
    status: 'BACKLOG',
    surface: 'bg-stone-50/80',
  },
  {
    accent: 'bg-sky-500',
    description: 'Ready for someone to start',
    label: 'Todo',
    status: 'TODO',
    surface: 'bg-sky-50/60',
  },
  {
    accent: 'bg-amber-500',
    description: 'Work currently underway',
    label: 'In progress',
    status: 'IN_PROGRESS',
    surface: 'bg-amber-50/60',
  },
  {
    accent: 'bg-red-500',
    description: 'Waiting on a resolution',
    label: 'Blocked',
    status: 'BLOCKED',
    surface: 'bg-red-50/60',
  },
  {
    accent: 'bg-violet-500',
    description: 'Ready for feedback or approval',
    label: 'In review',
    status: 'IN_REVIEW',
    surface: 'bg-violet-50/60',
  },
  {
    accent: 'bg-emerald-600',
    description: 'Completed work',
    label: 'Done',
    status: 'DONE',
    surface: 'bg-emerald-50/60',
  },
];

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function priorityClass(priority: TaskSummary['priority']): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800';
    case 'HIGH':
      return 'bg-amber-100 text-amber-800';
    case 'LOW':
      return 'bg-stone-100 text-stone-600';
    default:
      return 'bg-sky-100 text-sky-800';
  }
}

interface KanbanBoardProps {
  canMove(task: TaskSummary): boolean;
  onMove(taskId: string, status: TaskStatus): Promise<void>;
  onSelect(taskId: string): Promise<void>;
  selectedTaskId: string | null;
  tasks: TaskSummary[];
  working: boolean;
}

export function KanbanBoard({
  canMove,
  onMove,
  onSelect,
  selectedTaskId,
  tasks,
  working,
}: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<TaskStatus | null>(null);

  function finishDrag() {
    setDraggedTaskId(null);
    setTargetStatus(null);
  }

  async function handleDrop(status: TaskStatus) {
    const task = tasks.find((item) => item.id === draggedTaskId);
    finishDrag();

    if (task === undefined || task.status === status || !canMove(task)) {
      return;
    }

    await onMove(task.id, status);
  }

  return (
    <div
      aria-label="Project Kanban board"
      className="overflow-x-auto pb-4"
      role="region"
    >
      <div className="grid min-w-[102rem] grid-cols-6 gap-4">
        {columns.map((column) => {
          const columnTasks = tasks.filter(
            (task) => task.status === column.status,
          );
          const isTarget = targetStatus === column.status;

          return (
            <section
              aria-label={`${column.label} column`}
              className={`min-h-[34rem] rounded-2xl border p-4 transition ${
                isTarget
                  ? 'border-emerald-700 bg-emerald-50'
                  : `border-emerald-950/10 ${column.surface}`
              }`}
              key={column.status}
              onDragEnter={() => setTargetStatus(column.status)}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget;
                if (
                  !(nextTarget instanceof Node) ||
                  !event.currentTarget.contains(nextTarget)
                ) {
                  setTargetStatus(null);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleDrop(column.status);
              }}
              role="region"
            >
              <div className="mb-4 px-1">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${column.accent}`} />
                  <h4 className="text-sm font-black text-emerald-950/80">
                    {column.label}
                  </h4>
                  <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-950/50 shadow-sm">
                    {columnTasks.length}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-emerald-950/45">
                  {column.description}
                </p>
              </div>

              <div className="space-y-3">
                {columnTasks.map((task) => {
                  const movable = canMove(task) && !working;
                  return (
                    <button
                      aria-label={`${task.taskKey} ${task.title}`}
                      className={`w-full cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        selectedTaskId === task.id
                          ? 'border-emerald-700 ring-2 ring-emerald-700/10'
                          : 'border-emerald-950/10'
                      } ${movable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      disabled={working}
                      draggable={movable}
                      key={task.id}
                      onClick={() => void onSelect(task.id)}
                      onDragEnd={finishDrag}
                      onDragStart={() => setDraggedTaskId(task.id)}
                      title={
                        movable
                          ? 'Drag to change status'
                          : 'Only an admin, reporter, or assignee can move this task'
                      }
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black tracking-wide text-emerald-700 uppercase">
                          {task.taskKey}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[0.65rem] font-black uppercase ${priorityClass(task.priority)}`}
                        >
                          {readable(task.priority)}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm font-black leading-6">
                        {task.title}
                      </span>
                      <span className="mt-4 block border-t border-emerald-950/5 pt-3 text-xs font-bold text-emerald-950/50">
                        {task.assignee?.name ?? 'Unassigned'}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-[0.68rem] font-semibold text-emerald-950/40">
                        <span>{readable(task.type)}</span>
                        <span>
                          {task.dueDate === null
                            ? 'No due date'
                            : `Due ${task.dueDate}`}
                        </span>
                      </span>
                    </button>
                  );
                })}

                {columnTasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-emerald-950/10 px-3 py-6 text-center text-xs text-emerald-950/35">
                    Drop tasks here
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
