import type {
  MockActivityCard,
  MockFile,
  MockKanbanCol,
  MockPane,
  MockTimelineEntry,
} from './types';

/**
 * Demo dataset reflects the Agent Team mechanic:
 *   - one Squad Lead pane plans the mission and routes work
 *   - several Mission Agents (builders) on different CLIs work in parallel
 *   - one Reviewer pane validates diffs before merge
 *   - kanban (To Claim / In Progress / Done) is the single source of truth
 * All names, missions and paths are fabricated.
 */

export const defaultPanes: MockPane[] = [
  // Squad Lead — planner / router
  { id: 'p-lead', name: 'Squad Lead',  agent: 'claude',   status: 'running', hue: 270,
    desc: 'Routing tasks for mission `checkout-revamp-v2`' },

  // Mission Agents (builders)
  { id: 'p-orion',    name: 'Orion',    agent: 'claude',   status: 'running', hue: 20,
    desc: 'Refactor cart store into typed reducer + selectors' },
  { id: 'p-meridian', name: 'Meridian', agent: 'codex',    status: 'running', hue: 320,
    desc: 'Add Stripe webhook handler with idempotency keys' },
  { id: 'p-zephyr',   name: 'Zephyr',   agent: 'opencode', status: 'waiting', hue: 45,
    desc: 'Waiting for review on payments PR #214' },
  { id: 'p-tessera',  name: 'Tessera',  agent: 'gemini',   status: 'running', hue: 290,
    desc: 'Rebuild storybook on the new design-token pipeline' },
  { id: 'p-halcyon',  name: 'Halcyon',  agent: 'claude',   status: 'idle',    hue: 5,
    desc: 'Last touched product-list virtualization' },
  { id: 'p-nimbus',   name: 'Nimbus',   agent: 'codex',    status: 'idle',    hue: 200,
    desc: '' },

  // Reviewer
  { id: 'p-reviewer', name: 'Reviewer', agent: 'claude',   status: 'running', hue: 50,
    desc: 'Reviewing diffs from Orion + Meridian' },

  // Scratch / sandbox pane
  { id: 'p-scratch',  name: 'Scratch',  agent: 'opencode', status: 'idle',    hue: 160,
    desc: '' },
];

export const defaultActivityCards: MockActivityCard[] = [
  { id: 'p-lead',     name: 'Squad Lead', hue: 270, status: 'Running', files: 2,  age: '14h 02m', duration: '8 min' },
  { id: 'p-orion',    name: 'Orion',      hue: 20,  status: 'Running', files: 7,  age: '12h 41m', duration: '24 min' },
  { id: 'p-meridian', name: 'Meridian',   hue: 320, status: 'Running', files: 4,  age: '9h 12m',  duration: '15 min' },
  { id: 'p-zephyr',   name: 'Zephyr',     hue: 45,  status: 'Waiting', files: 3,  age: '9h 11m',  duration: '2 min' },
  { id: 'p-tessera',  name: 'Tessera',    hue: 290, status: 'Running', files: 11, age: '5h 18m',  duration: '38 min' },
  { id: 'p-halcyon',  name: 'Halcyon',    hue: 5,   status: 'Idle',    files: 0,  age: '6h 30m',  duration: '—' },
  { id: 'p-nimbus',   name: 'Nimbus',     hue: 200, status: 'Idle',    files: 0,  age: '4h 02m',  duration: '—' },
  { id: 'p-reviewer', name: 'Reviewer',   hue: 50,  status: 'Running', files: 5,  age: '1h 06m',  duration: '4 min' },
  { id: 'p-scratch',  name: 'Scratch',    hue: 160, status: 'Idle',    files: 0,  age: '2h 47m',  duration: '—' },
];

export const defaultTimeline: MockTimelineEntry[] = [];

export const defaultKanban: MockKanbanCol[] = [
  {
    name: 'To Claim',
    count: '0/0',
    cards: [],
  },
  {
    name: 'In Progress',
    count: '0/0',
    cards: [],
  },
  {
    name: 'Done',
    count: '43/43',
    cards: [
      { id: '8b3c6e5', title: 'Wire Stripe receipt email into the mailer queue. Reviewer signed off on the final diff.',
        assignTo: 'Orion', assignFrom: 'Squad Lead' },
    ],
  },
];

export const defaultFiles: MockFile[] = [
  { name: '.mexus',              isDir: true, depth: 0 },
  { name: 'agent-team',          isDir: true, depth: 0 },
  { name: 'missions',            isDir: true, depth: 1 },
  { name: 'checkout-revamp-v2',  isDir: true, depth: 2 },
  { name: 'kanban.md',           depth: 3 },
  { name: 'agents.md',           depth: 2 },
  { name: 'mission-workflow.md', depth: 2 },
  { name: 'apps',                isDir: true, depth: 0 },
  { name: 'web',                 isDir: true, depth: 1 },
  { name: 'src/routes/checkout.tsx', mark: 'M', depth: 2 },
  { name: 'src/routes/cart.tsx',     mark: 'M', depth: 2 },
  { name: 'src/lib/cart-store.ts',   mark: 'M', depth: 2 },
  { name: 'mailer',              isDir: true, depth: 1 },
  { name: 'src/queue.ts',            mark: 'A', depth: 2 },
  { name: 'packages',            isDir: true, depth: 0 },
  { name: 'design-tokens',       isDir: true, depth: 1 },
  { name: 'src/tokens.ts',           mark: 'M', depth: 2 },
  { name: 'payments',            isDir: true, depth: 1 },
  { name: 'src/stripe/webhook.ts',   mark: 'A', depth: 2 },
  { name: 'src/stripe/client.ts',    depth: 2 },
];
