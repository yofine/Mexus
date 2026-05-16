/* ── Top-level mocks ─────────────────────────────────────── */
export { WorkspaceMock } from './components/WorkspaceMock';
export type { WorkspaceMockProps } from './components/WorkspaceMock';
export { HubMock } from './components/HubMock';
export type { HubMockProps } from './components/HubMock';
export { TeamMock } from './components/TeamMock';
export type { TeamMockProps } from './components/TeamMock';

/* ── Fully interactive demo ──────────────────────────────── */
export { InteractiveMexus } from './components/InteractiveMexus';
export type { InteractiveMexusProps } from './components/InteractiveMexus';

/* ── Region-level components ─────────────────────────────── */
export { AppTopBar } from './components/AppTopBar';
export type { AppTab } from './components/AppTopBar';
export { PanesColumn } from './components/PanesColumn';
export { ActivityPanel } from './components/ActivityPanel';
export { TeamPanel } from './components/TeamPanel';
export { FilesPanel } from './components/FilesPanel';
export { StatusBar } from './components/StatusBar';

/* ── Atoms (gallery-level primitives) ────────────────────── */
export {
  GhostButton,
  AccentButton,
  StatusPill,
  Tab,
  SubtabPill,
  PaneRow,
  ActivityCard,
  KanbanCard,
  KanbanColumn,
  MissionSelector,
  MissionHeader,
  FileRow,
  HubInstanceCard,
  HubCreateForm,
  FormField,
} from './components/atoms';
export type {
  GhostButtonProps,
  AccentButtonProps,
  PillStatus,
  TabItemProps,
  SubtabItemProps,
  PaneRowProps,
  ActivityCardProps,
  KanbanCardProps,
  KanbanColumnProps,
  MissionSelectorProps,
  MissionHeaderProps,
  FileRowProps,
  HubInstanceCardProps,
  HubCreateFormProps,
  FormFieldProps,
} from './components/atoms';

/* ── Visual primitives ───────────────────────────────────── */
export { AgentIcon, getAgentDisplayName } from './components/AgentIcon';
export { PaneAvatar, StatusDot, Icon, FrameChrome, ChevronDown, ChevronRight } from './components/primitives';
export type { IconName } from './components/primitives';

/* ── Mocks ───────────────────────────────────────────────── */
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
