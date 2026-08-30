import {
  PrismaClient,
  TaskPriority,
  TaskStatus,
  TaskType,
  TeamRole,
  UserRole,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'TarzanDemo1!';
const TEAM_ID = '00000000-0000-4000-8000-000000000101';
const PROJECT_ID = '00000000-0000-4000-8000-000000000201';

const users = [
  {
    email: 'admin@tarzan.local',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Asha Admin',
    role: UserRole.ADMIN,
  },
  {
    email: 'arjun@tarzan.local',
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Arjun Rao',
    role: UserRole.MEMBER,
  },
  {
    email: 'maya@tarzan.local',
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Maya Shah',
    role: UserRole.MEMBER,
  },
  {
    email: 'neel@tarzan.local',
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Neel Kumar',
    role: UserRole.MEMBER,
  },
  {
    email: 'zoya@tarzan.local',
    id: '00000000-0000-4000-8000-000000000005',
    name: 'Zoya Khan',
    role: UserRole.MEMBER,
  },
];

const tasks = [
  {
    assigneeEmail: null,
    description:
      'Interview recent users and summarize the top onboarding gaps.',
    dueDate: '2026-09-04',
    id: '00000000-0000-4000-8000-000000001001',
    labels: ['research', 'onboarding'],
    priority: TaskPriority.MEDIUM,
    reporterEmail: 'maya@tarzan.local',
    status: TaskStatus.BACKLOG,
    title: 'Discover onboarding friction',
    type: TaskType.STORY,
  },
  {
    assigneeEmail: 'zoya@tarzan.local',
    description: 'Create the shared checklist for the first public release.',
    dueDate: '2026-09-05',
    id: '00000000-0000-4000-8000-000000001002',
    labels: ['launch', 'operations'],
    priority: TaskPriority.MEDIUM,
    reporterEmail: 'admin@tarzan.local',
    status: TaskStatus.TODO,
    title: 'Draft launch checklist',
    type: TaskType.TASK,
  },
  {
    assigneeEmail: 'arjun@tarzan.local',
    description:
      'Build the responsive project overview and task summary cards.',
    dueDate: '2026-09-08',
    id: '00000000-0000-4000-8000-000000001003',
    labels: ['frontend', 'dashboard'],
    priority: TaskPriority.HIGH,
    reporterEmail: 'admin@tarzan.local',
    status: TaskStatus.IN_PROGRESS,
    title: 'Implement dashboard shell',
    type: TaskType.STORY,
  },
  {
    assigneeEmail: 'neel@tarzan.local',
    description:
      'Menu overlays content on compact screens and blocks navigation.',
    dueDate: '2026-09-02',
    id: '00000000-0000-4000-8000-000000001004',
    labels: ['frontend', 'mobile'],
    priority: TaskPriority.CRITICAL,
    reporterEmail: 'maya@tarzan.local',
    status: TaskStatus.BLOCKED,
    title: 'Fix mobile navigation',
    type: TaskType.BUG,
  },
  {
    assigneeEmail: 'maya@tarzan.local',
    description:
      'Check registration, login, and session-expiry messages for clarity.',
    dueDate: '2026-09-03',
    id: '00000000-0000-4000-8000-000000001005',
    labels: ['content', 'auth'],
    priority: TaskPriority.MEDIUM,
    reporterEmail: 'zoya@tarzan.local',
    status: TaskStatus.IN_REVIEW,
    title: 'Review authentication copy',
    type: TaskType.TASK,
  },
  {
    assigneeEmail: 'arjun@tarzan.local',
    description: 'Deliver the completed password reset experience.',
    dueDate: '2026-08-29',
    id: '00000000-0000-4000-8000-000000001006',
    labels: ['backend', 'auth'],
    priority: TaskPriority.HIGH,
    reporterEmail: 'admin@tarzan.local',
    status: TaskStatus.DONE,
    title: 'Ship password reset',
    type: TaskType.STORY,
  },
  {
    assigneeEmail: 'neel@tarzan.local',
    description:
      'Track registration, team creation, and first-task conversion events.',
    dueDate: '2026-09-10',
    id: '00000000-0000-4000-8000-000000001007',
    labels: ['analytics', 'backend'],
    priority: TaskPriority.HIGH,
    reporterEmail: 'admin@tarzan.local',
    status: TaskStatus.TODO,
    title: 'Instrument funnel events',
    type: TaskType.TASK,
  },
  {
    assigneeEmail: 'zoya@tarzan.local',
    description:
      'Add useful guidance when teams, projects, or filtered lists are empty.',
    dueDate: '2026-09-11',
    id: '00000000-0000-4000-8000-000000001008',
    labels: ['frontend', 'ux'],
    priority: TaskPriority.LOW,
    reporterEmail: 'maya@tarzan.local',
    status: TaskStatus.IN_PROGRESS,
    title: 'Polish empty states',
    type: TaskType.TASK,
  },
  {
    assigneeEmail: null,
    description: 'Due dates render one day early for users west of UTC.',
    dueDate: '2026-09-06',
    id: '00000000-0000-4000-8000-000000001009',
    labels: ['dates', 'backend'],
    priority: TaskPriority.HIGH,
    reporterEmail: 'neel@tarzan.local',
    status: TaskStatus.BACKLOG,
    title: 'Resolve timezone regression',
    type: TaskType.BUG,
  },
  {
    assigneeEmail: 'maya@tarzan.local',
    description:
      'Document escalation paths and answers for common launch questions.',
    dueDate: '2026-09-12',
    id: '00000000-0000-4000-8000-000000001010',
    labels: ['support', 'launch'],
    priority: TaskPriority.MEDIUM,
    reporterEmail: 'zoya@tarzan.local',
    status: TaskStatus.IN_REVIEW,
    title: 'Write support playbook',
    type: TaskType.TASK,
  },
  {
    assigneeEmail: 'arjun@tarzan.local',
    description:
      'Allow project admins to export the current filtered task list.',
    dueDate: '2026-08-28',
    id: '00000000-0000-4000-8000-000000001011',
    labels: ['export', 'frontend'],
    priority: TaskPriority.MEDIUM,
    reporterEmail: 'admin@tarzan.local',
    status: TaskStatus.DONE,
    title: 'Add CSV export',
    type: TaskType.STORY,
  },
  {
    assigneeEmail: 'zoya@tarzan.local',
    description: 'Resolve keyboard and color contrast findings before release.',
    dueDate: '2026-09-01',
    id: '00000000-0000-4000-8000-000000001012',
    labels: ['accessibility', 'quality'],
    priority: TaskPriority.CRITICAL,
    reporterEmail: 'maya@tarzan.local',
    status: TaskStatus.TODO,
    title: 'Verify accessibility audit',
    type: TaskType.BUG,
  },
];

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const seededUsers = new Map();

  for (const user of users) {
    const seededUser = await prisma.user.upsert({
      create: { ...user, passwordHash },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
      },
      where: { email: user.email },
    });
    seededUsers.set(user.email, seededUser);
  }

  const admin = seededUsers.get('admin@tarzan.local');

  await prisma.team.upsert({
    create: {
      createdById: admin.id,
      id: TEAM_ID,
      name: 'Tarzan Demo Team',
    },
    update: { createdById: admin.id, name: 'Tarzan Demo Team' },
    where: { id: TEAM_ID },
  });

  for (const user of users) {
    const seededUser = seededUsers.get(user.email);
    await prisma.teamMember.upsert({
      create: {
        role: user.email === admin.email ? TeamRole.ADMIN : TeamRole.MEMBER,
        teamId: TEAM_ID,
        userId: seededUser.id,
      },
      update: {
        role: user.email === admin.email ? TeamRole.ADMIN : TeamRole.MEMBER,
      },
      where: { teamId_userId: { teamId: TEAM_ID, userId: seededUser.id } },
    });
  }

  await prisma.project.upsert({
    create: {
      createdById: admin.id,
      description:
        'A complete sample workspace for exploring the Tarzan MVP workflow.',
      id: PROJECT_ID,
      name: 'MVP Launch',
      teamId: TEAM_ID,
    },
    update: {
      createdById: admin.id,
      description:
        'A complete sample workspace for exploring the Tarzan MVP workflow.',
      name: 'MVP Launch',
      teamId: TEAM_ID,
    },
    where: { id: PROJECT_ID },
  });

  for (const task of tasks) {
    const assignee =
      task.assigneeEmail === null ? null : seededUsers.get(task.assigneeEmail);
    const reporter = seededUsers.get(task.reporterEmail);
    const data = {
      assigneeId: assignee?.id ?? null,
      description: task.description,
      dueDate: date(task.dueDate),
      labels: task.labels,
      priority: task.priority,
      projectId: PROJECT_ID,
      reporterId: reporter.id,
      status: task.status,
      title: task.title,
      type: task.type,
    };

    await prisma.task.upsert({
      create: { ...data, id: task.id },
      update: data,
      where: { id: task.id },
    });
  }

  const comments = [
    {
      content:
        'The responsive grid is in place; I am finishing keyboard states.',
      id: '00000000-0000-4000-8000-000000002001',
      taskId: tasks[2].id,
      userEmail: 'arjun@tarzan.local',
    },
    {
      content:
        'Please include the overdue and blocked task cases in the summary.',
      id: '00000000-0000-4000-8000-000000002002',
      taskId: tasks[2].id,
      userEmail: 'admin@tarzan.local',
    },
    {
      content:
        'Waiting for the updated mobile breakpoint design before proceeding.',
      id: '00000000-0000-4000-8000-000000002003',
      taskId: tasks[3].id,
      userEmail: 'neel@tarzan.local',
    },
    {
      content: 'Copy review is complete and ready for the final product pass.',
      id: '00000000-0000-4000-8000-000000002004',
      taskId: tasks[4].id,
      userEmail: 'maya@tarzan.local',
    },
  ];

  for (const comment of comments) {
    const user = seededUsers.get(comment.userEmail);
    await prisma.comment.upsert({
      create: {
        content: comment.content,
        id: comment.id,
        taskId: comment.taskId,
        userId: user.id,
      },
      update: {
        content: comment.content,
        taskId: comment.taskId,
        userId: user.id,
      },
      where: { id: comment.id },
    });
  }

  const activities = tasks.map((task, index) => ({
    action: 'TASK_CREATED',
    id: `00000000-0000-4000-8000-${String(3001 + index).padStart(12, '0')}`,
    metadata: { title: task.title },
    taskId: task.id,
    userId: seededUsers.get(task.reporterEmail).id,
  }));

  activities.push(
    {
      action: 'STATUS_CHANGED',
      id: '00000000-0000-4000-8000-000000003101',
      metadata: { from: 'TODO', to: 'IN_PROGRESS' },
      taskId: tasks[2].id,
      userId: admin.id,
    },
    {
      action: 'ASSIGNEE_CHANGED',
      id: '00000000-0000-4000-8000-000000003102',
      metadata: {
        from: null,
        to: {
          id: seededUsers.get('arjun@tarzan.local').id,
          name: 'Arjun Rao',
        },
      },
      taskId: tasks[2].id,
      userId: admin.id,
    },
  );

  for (const activity of activities) {
    await prisma.activity.upsert({
      create: activity,
      update: {
        action: activity.action,
        metadata: activity.metadata,
        taskId: activity.taskId,
        userId: activity.userId,
      },
      where: { id: activity.id },
    });
  }

  console.log(
    `Seeded ${users.length} users, 1 team, 1 project, ${tasks.length} tasks, ${comments.length} comments, and ${activities.length} activities.`,
  );
  console.log('Demo login: admin@tarzan.local / TarzanDemo1!');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
