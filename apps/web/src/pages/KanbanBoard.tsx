import type { TaskStatus, TaskSummary } from '@tarzan/types';
import { useState } from 'react';

const columns: Array<{
  accent: string;
  label: string;
  status: TaskStatus;
}> = [
  { accent: 'bg-stone-400', label: 'Backlog', status: 'BACKLOG' },
  { accent: 'bg-sky-500', label: 'Todo', status: 'TODO' },
  { accent: 'bg-amber-500', label: 'In progress', status: 'IN_PROGRESS' },
  { accent: 'bg-red-500', label: 'Blocked', status: 'BLOCKED' },
  { accent: 'bg-violet-500', label: 'In review', status: 'IN_REVIEW' },
  { accent: 'bg-emerald-600', label: 'Done', status: 'DONE' },
];

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
      className="overflow-x-auto pb-3"
      role="region"
    >
      <div className="grid min-w-[92rem] grid-cols-6 gap-3">
        {columns.map((column) => {
          const columnTasks = tasks.filter(
            (task) => task.status === column.status,
          );
          const isTarget = targetStatus === column.status;

          return (
            <section
              aria-label={`${column.label} column`}
              className={`min-h-72 rounded-2xl border p-3 transition ${
                isTarget
                  ? 'border-emerald-700 bg-emerald-50'
                  : 'border-emerald-950/10 bg-emerald-950/[0.025]'
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
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`size-2 rounded-full ${column.accent}`} />
                <h4 className="text-xs font-black tracking-wide text-emerald-950/70 uppercase">
                  {column.label}
                </h4>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-black text-emerald-950/45">
                  {columnTasks.length}
                </span>
              </div>

              <div className="space-y-2">
                {columnTasks.map((task) => {
                  const movable = canMove(task) && !working;
                  return (
                    <button
                      aria-label={`${task.taskKey} ${task.title}`}
                      className={`w-full cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        selectedTaskId === task.id
                          ? 'border-emerald-700 ring-2 ring-emerald-700/10'
                          : 'border-emerald-950/10'
                      } ${movable ? 'active:cursor-grabbing' : ''}`}
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
                      <span className="text-[0.65rem] font-black tracking-wide text-emerald-700 uppercase">
                        {task.taskKey} · {readable(task.type)}
                      </span>
                      <span className="mt-1.5 block text-sm font-black leading-5">
                        {task.title}
                      </span>
                      <span className="mt-3 flex items-center justify-between gap-2 text-[0.68rem] font-bold text-emerald-950/45">
                        <span>{task.assignee?.name ?? 'Unassigned'}</span>
                        <span>{readable(task.priority)}</span>
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
