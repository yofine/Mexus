export type PaneStatus = 'running' | 'waiting' | 'idle' | 'error';

export interface MockPane {
  id: string;
  name: string;
  agent: string;
  branch?: string;
  status: PaneStatus;
  desc?: string;
  hue: number;
  model?: string;
  ctx?: number;
  cost?: string;
  expanded?: boolean;
}

export interface MockActivityCard {
  id: string;
  name: string;
  hue: number;
  status: 'Running' | 'Waiting' | 'Idle';
  files: number;
  age: string;
  duration: string;
}

export interface MockTimelineEntry {
  time: string;
  text: string;
  detail?: string;
  highlight?: boolean;
}

export interface MockKanbanCard {
  id: string;
  title: string;
  assignTo?: string;
  assignFrom?: string;
}

export interface MockKanbanCol {
  name: 'To Claim' | 'In Progress' | 'Done';
  count: string;
  cards: MockKanbanCard[];
}

export interface MockFile {
  name: string;
  isDir?: boolean;
  depth: number;
  mark?: 'A' | 'M' | 'D';
}

export interface MockHubInstance {
  id: string;
  projectName: string;
  port: number;
  cwd: string;
  status: 'running' | 'idle';
  uptime: string;
  panes: number;
  pid?: number;
}
