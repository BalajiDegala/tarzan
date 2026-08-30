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

const admin = await register(
  'Collaboration Admin',
  `collaboration.admin.${runId}@example.test`,
);
const member = await register(
  'Collaboration Member',
  `collaboration.member.${runId}@example.test`,
);
const outsider = await register(
  'Collaboration Outsider',
  `collaboration.outsider.${runId}@example.test`,
);

const teamResult = await requestJson(
  '/teams',
  jsonOptions('POST', { name: `Collaboration ${runId}` }, admin.cookie),
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
    { name: `Collaboration project ${runId}`, teamId: team.id },
    admin.cookie,
  ),
);
const project = projectResult.body.project;
report('CREATE_PROJECT_STATUS', projectResult.response.status, 201);

const taskResult = await requestJson(
  '/tasks',
  jsonOptions(
    'POST',
    { projectId: project.id, title: `Review workflow ${runId}` },
    member.cookie,
  ),
);
const task = taskResult.body.task;
report('CREATE_TASK_STATUS', taskResult.response.status, 201);

const initialActivity = await requestJson(`/tasks/${task.id}/activity`, {
  headers: { Cookie: member.cookie },
});
report('INITIAL_ACTIVITY_STATUS', initialActivity.response.status, 200);
report(
  'TASK_CREATED_RECORDED',
  initialActivity.body.activities[0]?.action,
  'TASK_CREATED',
);
report(
  'TASK_CREATED_ACTOR',
  initialActivity.body.activities[0]?.actor.id,
  member.user.id,
);

const commentResult = await requestJson(
  `/tasks/${task.id}/comments`,
  jsonOptions(
    'POST',
    { content: 'The implementation is ready for review.' },
    member.cookie,
  ),
);
report('CREATE_COMMENT_STATUS', commentResult.response.status, 201);
report('COMMENT_AUTHOR', commentResult.body.comment.author.id, member.user.id);

const commentsResult = await requestJson(`/tasks/${task.id}/comments`, {
  headers: { Cookie: admin.cookie },
});
report('ADMIN_LIST_COMMENTS_STATUS', commentsResult.response.status, 200);
report('COMMENT_PERSISTED', commentsResult.body.comments.length, 1);
report(
  'COMMENT_CONTENT_PERSISTED',
  commentsResult.body.comments[0]?.content,
  'The implementation is ready for review.',
);

const blankComment = await requestJson(
  `/tasks/${task.id}/comments`,
  jsonOptions('POST', { content: '   ' }, member.cookie),
);
report('BLANK_COMMENT_REJECTED', blankComment.response.status, 400);

const taskUpdate = await requestJson(
  `/tasks/${task.id}`,
  jsonOptions('PATCH', { priority: 'HIGH' }, member.cookie),
);
report('TASK_UPDATE_STATUS', taskUpdate.response.status, 200);

const statusUpdate = await requestJson(
  `/tasks/${task.id}/status`,
  jsonOptions('PATCH', { status: 'IN_REVIEW' }, member.cookie),
);
report('STATUS_UPDATE_STATUS', statusUpdate.response.status, 200);

const assigneeUpdate = await requestJson(
  `/tasks/${task.id}/assignee`,
  jsonOptions('PATCH', { assigneeId: member.user.id }, admin.cookie),
);
report('ASSIGNEE_UPDATE_STATUS', assigneeUpdate.response.status, 200);

const activityResult = await requestJson(`/tasks/${task.id}/activity`, {
  headers: { Cookie: member.cookie },
});
const activities = activityResult.body.activities;
const actions = activities.map((activity) => activity.action);
report('ACTIVITY_LIST_STATUS', activityResult.response.status, 200);
report('TASK_UPDATED_RECORDED', actions.includes('TASK_UPDATED'), true);
report('STATUS_CHANGED_RECORDED', actions.includes('STATUS_CHANGED'), true);
report('ASSIGNEE_CHANGED_RECORDED', actions.includes('ASSIGNEE_CHANGED'), true);
const statusActivity = activities.find(
  (activity) => activity.action === 'STATUS_CHANGED',
);
report('STATUS_FROM_METADATA', statusActivity?.metadata.from, 'BACKLOG');
report('STATUS_TO_METADATA', statusActivity?.metadata.to, 'IN_REVIEW');
const assignmentActivity = activities.find(
  (activity) => activity.action === 'ASSIGNEE_CHANGED',
);
report(
  'ASSIGNEE_METADATA',
  assignmentActivity?.metadata.to?.id,
  member.user.id,
);

const outsiderComments = await request(`/tasks/${task.id}/comments`, {
  headers: { Cookie: outsider.cookie },
});
report('OUTSIDER_COMMENTS_HIDDEN', outsiderComments.status, 404);

const outsiderActivity = await request(`/tasks/${task.id}/activity`, {
  headers: { Cookie: outsider.cookie },
});
report('OUTSIDER_ACTIVITY_HIDDEN', outsiderActivity.status, 404);

const outsiderComment = await request(
  `/tasks/${task.id}/comments`,
  jsonOptions('POST', { content: 'Blocked comment' }, outsider.cookie),
);
report('OUTSIDER_CANNOT_COMMENT', outsiderComment.status, 404);
