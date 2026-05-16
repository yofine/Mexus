export { WorkspaceMock } from './components/WorkspaceMock';
export type { WorkspaceMockProps } from './components/WorkspaceMock';
export { HubMock } from './components/HubMock';
export type { HubMockProps } from './components/HubMock';
export { TeamMock } from './components/TeamMock';
export type { TeamMockProps } from './components/TeamMock';

export { AppTopBar } from './components/AppTopBar';
export type { AppTab } from './components/AppTopBar';

export { AgentIcon, getAgentDisplayName } from './components/AgentIcon';
export { PaneAvatar, StatusDot, Icon, FrameChrome } from './components/primitives';
export type { IconName } from './components/primitives';

export {
  defaultPanes,
  defaultActivityCards,
  defaultTimeline,
  defaultKanban,
  defaultFiles,
} from './mocks/workspace';
export { defaultHubInstances } from './mocks/hub';

export type {
  MockPane,
  MockActivityCard,
  MockTimelineEntry,
  MockKanbanCol,
  MockKanbanCard,
  MockFile,
  MockHubInstance,
  PaneStatus,
} from './mocks/types';
