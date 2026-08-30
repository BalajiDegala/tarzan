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

  if (!passed) {
    process.exitCode = 1;
  }
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
  'Project Admin',
  `project.admin.${runId}@example.test`,
);
const member = await register(
  'Project Member',
  `project.member.${runId}@example.test`,
);
const outsider = await register(
  'Project Outsider',
  `project.outsider.${runId}@example.test`,
);

const teamResult = await requestJson(
  '/teams',
  jsonOptions('POST', { name: `Delivery ${runId}` }, admin.cookie),
);
const team = teamResult.body.team;
report('CREATE_TEAM_STATUS', teamResult.response.status, 201);

const addResult = await requestJson(
  `/teams/${team.id}/members`,
  jsonOptions(
    'POST',
    { email: member.user.email, role: 'MEMBER' },
    admin.cookie,
  ),
);
report('ADD_MEMBER_STATUS', addResult.response.status, 201);

const createResult = await requestJson(
  '/projects',
  jsonOptions(
    'POST',
    {
      description: 'Initial project description',
      name: `Customer portal ${runId}`,
      teamId: team.id,
    },
    admin.cookie,
  ),
);
const project = createResult.body.project;
report('CREATE_PROJECT_STATUS', createResult.response.status, 201);
report('PROJECT_TEAM_LINK', project.teamId, team.id);
report('CREATOR_PROJECT_ROLE', project.teamRole, 'ADMIN');

const memberList = await requestJson(`/projects?teamId=${team.id}`, {
  headers: { Cookie: member.cookie },
});
report('MEMBER_CAN_LIST_PROJECTS', memberList.response.status, 200);
report(
  'MEMBER_LIST_CONTAINS_PROJECT',
  memberList.body.projects[0]?.id,
  project.id,
);

const memberDetail = await requestJson(`/projects/${project.id}`, {
  headers: { Cookie: member.cookie },
});
report('MEMBER_CAN_VIEW_PROJECT', memberDetail.response.status, 200);
report('MEMBER_PROJECT_ROLE', memberDetail.body.project.teamRole, 'MEMBER');

const memberUpdate = await requestJson(
  `/projects/${project.id}`,
  jsonOptions('PATCH', { name: 'Blocked edit' }, member.cookie),
);
report('MEMBER_CANNOT_EDIT_PROJECT', memberUpdate.response.status, 403);

const adminUpdate = await requestJson(
  `/projects/${project.id}`,
  jsonOptions(
    'PATCH',
    { description: '', name: `Portal relaunch ${runId}` },
    admin.cookie,
  ),
);
report('ADMIN_CAN_EDIT_PROJECT', adminUpdate.response.status, 200);
report(
  'UPDATED_PROJECT_NAME',
  adminUpdate.body.project.name,
  `Portal relaunch ${runId}`,
);
report(
  'DESCRIPTION_CAN_BE_CLEARED',
  adminUpdate.body.project.description,
  null,
);

const outsiderDetail = await request(`/projects/${project.id}`, {
  headers: { Cookie: outsider.cookie },
});
report('OUTSIDER_PROJECT_HIDDEN', outsiderDetail.status, 404);

const outsiderList = await requestJson('/projects', {
  headers: { Cookie: outsider.cookie },
});
report('OUTSIDER_LIST_EXCLUDES_PROJECT', outsiderList.body.projects.length, 0);
