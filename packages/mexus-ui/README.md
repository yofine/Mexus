# @mexus/ui

Pure presentation components for Mexus. Renders the Workspace and Hub UI from mock data — no server, no PTY, no Zustand store.

Consumed by `site/` (landing) today; designed so a future hosted Mexus product can mount the same components on real APIs.

## Usage

```tsx
import { WorkspaceMock, HubMock } from '@mexus/ui';
import '@mexus/ui/styles.css';

<WorkspaceMock />   {/* hero visual */}
<HubMock />         {/* sub-feature: multi-server */}
```

Override defaults by passing `data` props (see `src/mocks/`).
