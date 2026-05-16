import type { MockHubInstance } from './types';

// Hub demo dataset — fabricated, not tied to any real project.
export const defaultHubInstances: MockHubInstance[] = [
  {
    id: 'shop',
    projectName: 'shop',
    port: 7700,
    cwd: '~/code/shop',
    status: 'running',
    uptime: '8h ago',
    panes: 9,
    pid: 31204,
  },
];
