import type { ActivityAction, TaskActivity, TaskComment } from '@tarzan/types';
import { useEffect, useState } from 'react';

import { collaborationApi } from '../lib/api';

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function objectValue(
  metadata: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = metadata[key];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function activityText(activity: TaskActivity): string {
  const actor = activity.actor.name;

  switch (activity.action) {
    case 'TASK_CREATED':
      return `${actor} created this task`;
    case 'TASK_UPDATED': {
      const fields = activity.metadata.fields;
      const fieldNames = Array.isArray(fields)
        ? fields.filter((field): field is string => typeof field === 'string')
        : [];
      return `${actor} updated ${
        fieldNames.length === 0 ? 'the task' : fieldNames.join(', ')
      }`;
    }
    case 'STATUS_CHANGED': {
      const from = activity.metadata.from;
      const to = activity.metadata.to;
      return `${actor} moved the task from ${
        typeof from === 'string' ? readable(from) : 'Unknown'
      } to ${typeof to === 'string' ? readable(to) : 'Unknown'}`;
    }
    case 'ASSIGNEE_CHANGED': {
      const nextAssignee = objectValue(activity.metadata, 'to');
      const name = nextAssignee?.name;
      return name === undefined
        ? `${actor} unassigned the task`
        : `${actor} assigned the task to ${String(name)}`;
    }
    default:
      return `${actor} updated the task`;
  }
}

interface TaskCollaborationProps {
  refreshVersion: number;
  taskId: string;
}

export function TaskCollaboration({
  refreshVersion,
  taskId,
}: TaskCollaborationProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      collaborationApi.listComments(taskId),
      collaborationApi.listActivity(taskId),
    ])
      .then(([commentResponse, activityResponse]) => {
        if (active) {
          setComments(commentResponse.comments);
          setActivities(activityResponse.activities);
          setError(null);
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load collaboration history.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshVersion, taskId]);

  async function handleComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    try {
      const { comment } = await collaborationApi.createComment(taskId, content);
      setComments((current) => [...current, comment]);
      setContent('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to add the comment.',
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mt-5 grid gap-4 border-t border-emerald-950/10 pt-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-emerald-950/10 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-black">Comments</h4>
          <span className="rounded-full bg-emerald-950/5 px-2.5 py-1 text-xs font-black text-emerald-800">
            {comments.length}
          </span>
        </div>

        <form onSubmit={(event) => void handleComment(event)}>
          <label className="text-xs font-black tracking-wide text-emerald-900 uppercase">
            Add comment
            <textarea
              className="mt-2 min-h-20 w-full resize-y rounded-xl border border-emerald-950/10 px-4 py-3 text-sm font-medium normal-case outline-none focus:border-emerald-700"
              maxLength={5000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Share an update or question"
              required
              value={content}
            />
          </label>
          <button
            className="mt-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
            disabled={working}
            type="submit"
          >
            Post comment
          </button>
        </form>

        {error === null ? null : (
          <p className="mt-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-5 text-sm text-emerald-950/45">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="mt-5 text-sm text-emerald-950/45">
            No comments yet. Start the conversation.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {comments.map((comment) => (
              <li
                className="rounded-xl bg-emerald-950/[0.035] p-4"
                key={comment.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">
                    {comment.author.name}
                  </span>
                  <time className="text-[0.68rem] text-emerald-950/40">
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950/65">
                  {comment.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-950/10 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-black">Activity</h4>
          <span className="rounded-full bg-emerald-950/5 px-2.5 py-1 text-xs font-black text-emerald-800">
            {activities.length}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-emerald-950/45">Loading activity…</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-emerald-950/45">No activity recorded.</p>
        ) : (
          <ol className="space-y-4">
            {activities.map((activity) => (
              <li className="relative pl-6" key={activity.id}>
                <span className="absolute top-1.5 left-0 size-2.5 rounded-full bg-lime-400 ring-4 ring-lime-100" />
                <p className="text-sm font-semibold text-emerald-950/70">
                  {activityText(activity)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[0.68rem] font-bold text-emerald-950/35">
                  <span>{readable(activity.action as ActivityAction)}</span>
                  <span>·</span>
                  <time>{new Date(activity.createdAt).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
