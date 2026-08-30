const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173/api';

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = response.status === 204 ? undefined : await response.json();
  return { body, response };
}

function report(label, actual, expected) {
  const passed = actual === expected;
  console.log(`${label}=${passed ? 'PASS' : `FAIL (${String(actual)})`}`);
  if (!passed) process.exitCode = 1;
}

const login = await requestJson('/auth/login', {
  body: JSON.stringify({
    email: 'admin@tarzan.local',
    password: 'TarzanDemo1!',
  }),
  headers: { 'Content-Type': 'application/json' },
  method: 'POST',
});
report('DEMO_LOGIN_STATUS', login.response.status, 200);
report('DEMO_ADMIN_ROLE', login.body.user?.role, 'ADMIN');

const cookie = (login.response.headers.get('set-cookie') ?? '').split(
  ';',
  1,
)[0];
const authHeaders = { Cookie: cookie };

const teams = await requestJson('/teams', { headers: authHeaders });
const demoTeam = teams.body.teams?.find(
  (team) => team.name === 'Tarzan Demo Team',
);
report('DEMO_TEAM_VISIBLE', demoTeam !== undefined, true);
report('DEMO_TEAM_MEMBERS', demoTeam?.memberCount, 5);

const projects = await requestJson(`/projects?teamId=${demoTeam?.id ?? ''}`, {
  headers: authHeaders,
});
const demoProject = projects.body.projects?.find(
  (project) => project.name === 'MVP Launch',
);
report('DEMO_PROJECT_VISIBLE', demoProject !== undefined, true);

const tasks = await requestJson(`/tasks?projectId=${demoProject?.id ?? ''}`, {
  headers: authHeaders,
});
const expectedTitles = [
  'Discover onboarding friction',
  'Draft launch checklist',
  'Implement dashboard shell',
  'Fix mobile navigation',
  'Review authentication copy',
  'Ship password reset',
  'Instrument funnel events',
  'Polish empty states',
  'Resolve timezone regression',
  'Write support playbook',
  'Add CSV export',
  'Verify accessibility audit',
];
const actualTitles = new Set(tasks.body.tasks?.map((task) => task.title));
report(
  'TWELVE_SEEDED_TASKS_VISIBLE',
  expectedTitles.every((title) => actualTitles.has(title)),
  true,
);

const sampleTask = tasks.body.tasks?.find(
  (task) => task.title === 'Implement dashboard shell',
);
const comments = await requestJson(`/tasks/${sampleTask?.id ?? ''}/comments`, {
  headers: authHeaders,
});
report('SAMPLE_COMMENTS_STATUS', comments.response.status, 200);
report('SAMPLE_COMMENTS_PRESENT', comments.body.comments?.length >= 2, true);

const activity = await requestJson(`/tasks/${sampleTask?.id ?? ''}/activity`, {
  headers: authHeaders,
});
const actions = new Set(activity.body.activities?.map((item) => item.action));
report('SAMPLE_ACTIVITY_STATUS', activity.response.status, 200);
report('TASK_CREATED_ACTIVITY_PRESENT', actions.has('TASK_CREATED'), true);
report('STATUS_ACTIVITY_PRESENT', actions.has('STATUS_CHANGED'), true);
report('ASSIGNEE_ACTIVITY_PRESENT', actions.has('ASSIGNEE_CHANGED'), true);

const filtered = await requestJson(
  `/tasks?projectId=${demoProject?.id ?? ''}&status=BLOCKED&priority=CRITICAL&type=BUG&label=mobile`,
  { headers: authHeaders },
);
report('SEEDED_FILTER_STATUS', filtered.response.status, 200);
report('SEEDED_FILTER_RESULT', filtered.body.tasks?.length, 1);
report(
  'SEEDED_FILTER_TITLE',
  filtered.body.tasks?.[0]?.title,
  'Fix mobile navigation',
);
