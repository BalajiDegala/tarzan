const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173/api';
const runId = Date.now();
const password = 'StrongPass1';

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function requestJson(path, options = {}) {
  const response = await request(path, options);
  const body = response.status === 204 ? undefined : await response.json();
  return { body, response };
}

function jsonOptions(method, body, cookie) {
  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    method,
  };
}

function report(label, actual, expected) {
  const passed = actual === expected;
  console.log(`${label}=${passed ? 'PASS' : `FAIL (${String(actual)})`}`);
  if (!passed) process.exitCode = 1;
}

async function register(name, email) {
  const { body, response } = await requestJson(
    '/auth/register',
    jsonOptions('POST', { email, name, password }),
  );
  report(
    `${name.toUpperCase().replaceAll(' ', '_')}_REGISTER`,
    response.status,
    201,
  );
  return {
    cookie: (response.headers.get('set-cookie') ?? '').split(';', 1)[0],
    user: body.user,
  };
}

const admin = await register('Task Admin', `task.admin.${runId}@example.test`);
const member = await register(
  'Task Member',
  `task.member.${runId}@example.test`,
);
const outsider = await register(
  'Task Outsider',
  `task.outsider.${runId}@example.test`,
);

const teamResult = await requestJson(
  '/teams',
  jsonOptions('POST', { name: `Product ${runId}` }, admin.cookie),
);
const team = teamResult.body.team;
report('CREATE_TEAM_STATUS', teamResult.response.status, 201);

const addMemberResult = await requestJson(
  `/teams/${team.id}/members`,
  jsonOptions(
    'POST',
    { email: member.user.email, role: 'MEMBER' },
    admin.cookie,
  ),
);
report('ADD_MEMBER_STATUS', addMemberResult.response.status, 201);

const projectResult = await requestJson(
  '/projects',
  jsonOptions(
    'POST',
    { name: `Checkout ${runId}`, teamId: team.id },
    admin.cookie,
  ),
);
const project = projectResult.body.project;
report('CREATE_PROJECT_STATUS', projectResult.response.status, 201);

const memberCreateResult = await requestJson(
  '/tasks',
  jsonOptions(
    'POST',
    {
      description: 'Implement payment creation endpoint',
      dueDate: '2026-09-10',
      labels: ['backend', 'api'],
      priority: 'HIGH',
      projectId: project.id,
      title: `Implement payment API ${runId}`,
      type: 'STORY',
    },
    member.cookie,
  ),
);
const memberTask = memberCreateResult.body.task;
report('MEMBER_CREATE_TASK_STATUS', memberCreateResult.response.status, 201);
report('GENERATED_TASK_KEY', /^TASK-\d+$/.test(memberTask.taskKey), true);
report('DEFAULT_TASK_STATUS', memberTask.status, 'BACKLOG');
report('TASK_REPORTER', memberTask.reporter.id, member.user.id);
report('TASK_DUE_DATE', memberTask.dueDate, '2026-09-10');
report('TASK_LABELS', memberTask.labels.join(','), 'backend,api');

const memberAssignOnCreate = await requestJson(
  '/tasks',
  jsonOptions(
    'POST',
    {
      assigneeId: member.user.id,
      projectId: project.id,
      title: 'Member assignment blocked',
    },
    member.cookie,
  ),
);
report(
  'MEMBER_CANNOT_ASSIGN_ON_CREATE',
  memberAssignOnCreate.response.status,
  403,
);

const adminCreateResult = await requestJson(
  '/tasks',
  jsonOptions(
    'POST',
    {
      priority: 'CRITICAL',
      projectId: project.id,
      title: `Production bug ${runId}`,
      type: 'BUG',
    },
    admin.cookie,
  ),
);
const adminTask = adminCreateResult.body.task;
report('ADMIN_CREATE_TASK_STATUS', adminCreateResult.response.status, 201);
report('TASK_KEYS_ARE_UNIQUE', adminTask.taskKey === memberTask.taskKey, false);

const unrelatedEdit = await requestJson(
  `/tasks/${adminTask.id}`,
  jsonOptions('PATCH', { title: 'Blocked edit' }, member.cookie),
);
report('UNRELATED_MEMBER_CANNOT_EDIT', unrelatedEdit.response.status, 403);

const invalidAssignee = await requestJson(
  `/tasks/${adminTask.id}/assignee`,
  jsonOptions('PATCH', { assigneeId: outsider.user.id }, admin.cookie),
);
report('OUTSIDER_CANNOT_BE_ASSIGNED', invalidAssignee.response.status, 400);

const assignResult = await requestJson(
  `/tasks/${adminTask.id}/assignee`,
  jsonOptions('PATCH', { assigneeId: member.user.id }, admin.cookie),
);
report('ADMIN_ASSIGN_STATUS', assignResult.response.status, 200);
report(
  'ASSIGNEE_IS_TEAM_MEMBER',
  assignResult.body.task.assignee.id,
  member.user.id,
);

const assigneeEdit = await requestJson(
  `/tasks/${adminTask.id}`,
  jsonOptions(
    'PATCH',
    { description: 'Investigating production failure' },
    member.cookie,
  ),
);
report('ASSIGNEE_CAN_EDIT_TASK', assigneeEdit.response.status, 200);

for (const status of ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE']) {
  const statusResult = await requestJson(
    `/tasks/${memberTask.id}/status`,
    jsonOptions('PATCH', { status }, member.cookie),
  );
  report(`WORKFLOW_${status}`, statusResult.body.task.status, status);
}

const persistedStatus = await requestJson(`/tasks/${memberTask.id}`, {
  headers: { Cookie: member.cookie },
});
report('KANBAN_STATUS_PERSISTED', persistedStatus.body.task.status, 'DONE');

const memberList = await requestJson(`/tasks?projectId=${project.id}`, {
  headers: { Cookie: member.cookie },
});
report('MEMBER_LIST_STATUS', memberList.response.status, 200);
report('MEMBER_LIST_COUNT', memberList.body.tasks.length, 2);

for (const [label, query, expectedTaskId] of [
  [
    'SEARCH_BY_KEY',
    `search=${encodeURIComponent(memberTask.taskKey)}`,
    memberTask.id,
  ],
  [
    'SEARCH_BY_TITLE',
    `search=${encodeURIComponent(`payment API ${runId}`)}`,
    memberTask.id,
  ],
  ['FILTER_STATUS', 'status=DONE', memberTask.id],
  ['FILTER_PRIORITY', 'priority=HIGH', memberTask.id],
  ['FILTER_TYPE', 'type=STORY', memberTask.id],
  ['FILTER_ASSIGNEE', `assigneeId=${member.user.id}`, adminTask.id],
  ['FILTER_LABEL', 'label=backend', memberTask.id],
]) {
  const filterResult = await requestJson(
    `/tasks?projectId=${project.id}&${query}`,
    { headers: { Cookie: member.cookie } },
  );
  report(label, filterResult.body.tasks[0]?.id, expectedTaskId);
}

const outsiderDetail = await request(`/tasks/${memberTask.id}`, {
  headers: { Cookie: outsider.cookie },
});
report('OUTSIDER_TASK_HIDDEN', outsiderDetail.status, 404);

const outsiderList = await requestJson('/tasks', {
  headers: { Cookie: outsider.cookie },
});
report('OUTSIDER_LIST_EXCLUDES_TASKS', outsiderList.body.tasks.length, 0);

const memberDelete = await request(`/tasks/${adminTask.id}`, {
  headers: { Cookie: member.cookie },
  method: 'DELETE',
});
report('MEMBER_CANNOT_DELETE', memberDelete.status, 403);

const adminDelete = await request(`/tasks/${adminTask.id}`, {
  headers: { Cookie: admin.cookie },
  method: 'DELETE',
});
report('ADMIN_DELETE_STATUS', adminDelete.status, 204);

const deletedTask = await request(`/tasks/${adminTask.id}`, {
  headers: { Cookie: admin.cookie },
});
report('DELETED_TASK_NOT_FOUND', deletedTask.status, 404);
