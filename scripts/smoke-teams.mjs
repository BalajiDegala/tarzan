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

function withJson(body, cookie) {
  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    method: 'POST',
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
    withJson({ email, name, password }),
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

const admin = await register('Team Admin', `team.admin.${runId}@example.test`);
const member = await register(
  'Team Member',
  `team.member.${runId}@example.test`,
);

const createResult = await requestJson(
  '/teams',
  withJson({ name: `Platform ${runId}` }, admin.cookie),
);
const team = createResult.body.team;
report('CREATE_TEAM_STATUS', createResult.response.status, 201);
report('CREATOR_IS_ADMIN', team.role, 'ADMIN');
report('INITIAL_MEMBER_COUNT', team.memberCount, 1);

const addResult = await requestJson(
  `/teams/${team.id}/members`,
  withJson({ email: member.user.email, role: 'MEMBER' }, admin.cookie),
);
report('ADD_MEMBER_STATUS', addResult.response.status, 201);
report('ADDED_MEMBER_ROLE', addResult.body.member.role, 'MEMBER');

const memberList = await requestJson('/teams', {
  headers: { Cookie: member.cookie },
});
report('MEMBER_CAN_LIST_TEAM', memberList.response.status, 200);
report('MEMBER_LIST_CONTAINS_TEAM', memberList.body.teams[0]?.id, team.id);

const memberDetails = await requestJson(`/teams/${team.id}`, {
  headers: { Cookie: member.cookie },
});
report('MEMBER_CAN_VIEW_TEAM', memberDetails.response.status, 200);
report('DETAIL_MEMBER_COUNT', memberDetails.body.team.memberCount, 2);

const forbiddenAdd = await requestJson(
  `/teams/${team.id}/members`,
  withJson({ email: admin.user.email, role: 'MEMBER' }, member.cookie),
);
report('MEMBER_CANNOT_MANAGE', forbiddenAdd.response.status, 403);

const lastAdminRemoval = await request(
  `/teams/${team.id}/members/${admin.user.id}`,
  { headers: { Cookie: admin.cookie }, method: 'DELETE' },
);
report('LAST_ADMIN_PROTECTED', lastAdminRemoval.status, 400);

const removal = await request(`/teams/${team.id}/members/${member.user.id}`, {
  headers: { Cookie: admin.cookie },
  method: 'DELETE',
});
report('REMOVE_MEMBER_STATUS', removal.status, 204);

const removedMemberAccess = await request(`/teams/${team.id}`, {
  headers: { Cookie: member.cookie },
});
report('REMOVED_MEMBER_ACCESS_REVOKED', removedMemberAccess.status, 404);
