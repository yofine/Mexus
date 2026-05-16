import type { MockHubInstance } from './types';

// Hub demo dataset — fabricated, not tied to any real project.
export const defaultHubInstances: MockHubInstance[] = [
  {
    id: 'shop',
    projectName: 'shop',
    port: 7700,
    cwd: '~/code/shop',
    status: 'running',
    uptime: '2h ago',
    panes: 9,
    pid: 31204,
  },
  {
    id: 'astro-blog',
    projectName: 'astro-blog',
    port: 7702,
    cwd: '~/code/astro-blog',
    status: 'running',
    uptime: '5h ago',
    panes: 3,
    pid: 31998,
  },
];
