# Implementation Plan: Agent Web UI

## Overview

This plan implements a real-time web-based GUI for the Autonomous Coding Agent system using React 18+ with TypeScript, Vite, Tailwind CSS, Framer Motion, React Flow, Recharts, WebSocket, i18next, Zustand, and React Router. The implementation progresses from foundational infrastructure (project setup, state, communication) through individual views to final integration and polish.

## Tasks

- [ ] 1. Project Setup and Core Infrastructure
  - [ ] 1.1 Initialize Vite project with React 18 + TypeScript and install dependencies
    - Create Vite React-TS project in `src/web-ui/`
    - Install: `zustand`, `react-router-dom`, `framer-motion`, `reactflow`, `recharts`, `i18next`, `react-i18next`, `tailwindcss`, `postcss`, `autoprefixer`
    - Install dev: `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
    - Configure `tailwind.config.ts` with dark theme colors, breakpoints, and custom spacing
    - Configure `tsconfig.json` with strict mode and path aliases
    - _Requirements: 13.1, 13.4, 14.1_

  - [ ] 1.2 Create theme configuration and ThemeProvider
    - Implement `ThemeConfig` interface with dark/light color palettes per design
    - Create `ThemeProvider` component using React context
    - Implement Zustand `ThemeSlice` with `toggleTheme` and `setTheme`
    - Add Tailwind CSS custom properties for theme tokens (background, text, accent, status colors)
    - Ensure dark theme background luminance < 15%, text contrast ratio >= 4.5:1
    - Add theme transition animation (300ms) using Framer Motion
    - _Requirements: 13.1, 13.2, 13.5_


  - [ ] 1.3 Create i18n configuration with English and Arabic resource bundles
    - Configure i18next with `react-i18next` integration
    - Create resource files: `en/common.json`, `en/dashboard.json`, ... (all 12 view namespaces)
    - Create resource files: `ar/common.json`, `ar/dashboard.json`, ... (all 12 view namespaces)
    - Implement Zustand `I18nSlice` with `locale`, `direction`, and `setLocale`
    - Implement locale-to-direction mapping (ar/he/fa → rtl, others → ltr)
    - Create `I18nProvider` wrapping `I18nextProvider` with RTL `dir` attribute on root
    - _Requirements: 15.1, 15.3, 15.4_

  - [ ] 1.4 Create application shell with routing and responsive layout
    - Set up React Router with routes for all 12 views (dashboard, tasks, dag, agents, performance, skills, memory, timeline, quality, recovery, feedback, settings)
    - Create `AppLayout` component with `NavigationSidebar`, `TopBar`, and `MainContent` (Outlet)
    - Implement responsive sidebar: full on ≥1024px, icons-only on 768-1023px, hamburger overlay on <768px
    - Create `NavigationSlice` in Zustand with `activeView`, `sidebarCollapsed`, `notifications`
    - Add navigation transitions using Framer Motion (no full page reloads)
    - _Requirements: 16.1, 16.2, 14.2, 14.3_

  - [ ] 1.5 Implement keyboard shortcuts system
    - Create keyboard shortcut registry from `defaultShortcuts` configuration
    - Implement global event listener for Ctrl+1-4 (navigation), Ctrl+Shift+T (theme), Ctrl+N (new task), Ctrl+K (search)
    - Ensure shortcuts dispatch actions exactly once per key combination
    - _Requirements: 16.5_


  - [ ] 1.6 Implement shared UI components library
    - Create `StatusBadge` component with consistent status-to-color mapping (blue=running, green=completed, red=failed, yellow=warning, gray=pending)
    - Create `ResourceGauge` component with threshold coloring (green<60%, yellow 60-85%, red>85%)
    - Create `AnimatedPanel` wrapper with Framer Motion enter/exit animations (150-400ms, easing curves)
    - Create `NotificationArea` component for global alerts
    - Create `ErrorBoundary` components at app, view, panel, and component levels with retry support
    - _Requirements: 13.3, 13.5, 12.3, 16.3_

- [ ] 2. WebSocket Communication Layer
  - [ ] 2.1 Implement WebSocket Manager with connection lifecycle
    - Create `WebSocketManager` class implementing the interface from design
    - Implement `connect()` with 3-second timeout, `disconnect()`, `send()`, `getConnectionStatus()`
    - Implement `onStatusChange` callback system for status transitions
    - Create Zustand `ConnectionSlice` tracking status, lastConnected, reconnectAttempt, missedEvents
    - Show connection status indicator in TopBar (connecting/connected/disconnected/reconnecting)
    - _Requirements: 1.1, 1.3_

  - [ ] 2.2 Implement Reconnection Engine with exponential backoff
    - Create `ReconnectionEngine` class with formula: `delay = min(1000 * 2^attempt, 30000)`
    - Implement `start()`, `stop()`, `reset()`, `getAttemptCount()`, `getNextDelay()`
    - Wire reconnection engine to trigger on `onclose` events
    - Queue missed events during disconnection for replay upon reconnection
    - _Requirements: 1.3_


  - [ ] 2.3 Implement Channel Multiplexer and subscription system
    - Create `ChannelMultiplexer` class with `registerChannel`, `unregisterChannel`, `routeMessage`
    - Implement JSON parsing of incoming messages into `WSEnvelope` format
    - Route messages to the correct channel handler exclusively
    - Support channels: `agents`, `tasks`, `metrics`, `alerts`, `dag`, `control`
    - Implement `subscribe()` method on WebSocketManager for selective channel subscription
    - _Requirements: 1.5_

  - [ ] 2.4 Implement state synchronization on reconnect
    - Send `snapshot_request` control message upon reconnection
    - Handle `snapshot_response` to hydrate all store slices with fresh data
    - Replay queued missed events after snapshot hydration
    - Implement 5-second timeout for snapshot response with retry (up to 3 attempts)
    - _Requirements: 1.4_

  - [ ]* 2.5 Write property tests for WebSocket layer
    - **Property 1: Exponential Backoff Formula** - Verify `min(1000 * 2^n, 30000)` for all n >= 0
    - **Property 2: Channel Multiplexing Routing** - Verify exclusive delivery to registered handler
    - **Validates: Requirements 1.3, 1.5**

- [ ] 3. Checkpoint - Core infrastructure verification
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 4. Zustand State Store Implementation
  - [ ] 4.1 Implement Agents and Tasks store slices
    - Create `AgentsSlice` with `agents` Map, `updateAgent`, `removeAgent`, `selectAgent`, `hydrateAgents`
    - Create `TasksSlice` with `tasks` Map, `taskHistory`, `submitTask`, `updateTask`, `setActiveTask`
    - Implement `TaskHistoryEntry` tracking with chronological ordering
    - Wire agents and tasks channels from WebSocket to update respective slices
    - _Requirements: 4.1, 2.5_

  - [ ] 4.2 Implement DAG and Performance store slices
    - Create `DAGSlice` with nodes Map, edges, criticalPath, parallelismMetrics, `updateNodeStatus`, `setDAG`, `setCriticalPath`
    - Create `PerformanceSlice` with timeSeries, categoryBreakdown, parallelismEfficiency, selectedTimeRange, optimizationFlags
    - Implement time range filtering: only include data points within `[now - rangeMs, now]`
    - Wire `dag` and `metrics` WebSocket channels to update these slices
    - _Requirements: 3.1, 3.4, 5.1, 5.4_

  - [ ] 4.3 Implement Skills and Memory store slices
    - Create `SkillsSlice` with skills array, search/filter/sort state, `setSearch`, `setSort`, `setFilters`
    - Implement skill filtering: match categories, languages, minConfidence, refinementBadge
    - Implement skill sorting by confidence, usageCount, createdAt, successRate (asc/desc)
    - Create `MemorySlice` with namespaces, entries, pagination (20 per page), search
    - Implement namespace entry count aggregation
    - _Requirements: 6.1, 6.2, 6.5, 7.1, 7.2_


  - [ ] 4.4 Implement Timeline, Quality, Recovery, Feedback, and Health store slices
    - Create `TimelineSlice` with commits, checkpoints, branches, `selectItem`, `initiateRollback`
    - Create `QualitySlice` with latestReview, issuesByCategory, filterSeverity, filterCategory, reworkStatus
    - Create `RecoverySlice` with errors, escalations, recoveryStats, activeDegradation
    - Create `FeedbackSlice` with pendingOutputs, acceptanceRates, `submitCorrection`, `acceptOutput`, `rejectOutput`
    - Create `HealthSlice` with systemStatus, resourceGauges, healthTimeline, serviceAlerts, degradationAlerts
    - _Requirements: 8.1, 9.1, 10.1, 10.4, 11.1, 12.1_

  - [ ] 4.5 Compose unified AppStore and wire WebSocket event handlers
    - Compose all 15 slices into single `AppStore` using Zustand's slice pattern
    - Create WebSocket event handler map that dispatches incoming messages to correct slice actions
    - Implement `hydrateState` function for snapshot_response that updates all slices atomically
    - _Requirements: 1.2, 1.4_

  - [ ]* 4.6 Write property tests for state transformations
    - **Property 3: Chronological Ordering Invariant** - Verify descending timestamp order for all collections
    - **Property 8: Time Range Filtering** - Verify correct filtering by time range
    - **Property 9: Category Metric Computation** - Verify successRate and avgDuration calculations
    - **Property 10: Parallelism Ratio Computation** - Verify cumulativeAgentTime / wallClockTime
    - **Property 12: Skill Search and Filter Correctness** - Verify inclusive/exclusive filtering
    - **Property 14: Skill Sort Order** - Verify ordering invariant for all sort fields
    - **Property 15: Namespace Entry Count Aggregation** - Verify counts match actual entries
    - **Property 16: Pagination Slice Correctness** - Verify correct page slicing and totalPages
    - **Validates: Requirements 2.5, 5.1, 5.2, 5.4, 6.1, 6.2, 6.5, 7.1, 7.2, 8.1, 10.1**


- [ ] 5. Dashboard View
  - [ ] 5.1 Implement Dashboard summary cards and agent grid
    - Create `DashboardView` component with summary cards: active tasks count, agent swarm status, recent errors, performance summary, system health indicator
    - Create `AgentCardGrid` displaying up to 10 `AgentCard` components in responsive grid
    - Each `AgentCard` shows: agent type, specialization, status, assigned task, resource utilization
    - Implement `HeartbeatIndicator` with live animation reflecting lastHeartbeat timestamp
    - Implement unresponsive detection: warning indicator when `(now - lastHeartbeat) > 30s`
    - Add click handler to expand agent detail view (full history, resource timeline, task details)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 16.4_

  - [ ] 5.2 Implement Health Monitor mini-timeline and system status overview
    - Create `HealthTimeline` component showing 24-hour system health transitions
    - Display overall system status (healthy/degraded/critical), active agent count, task queue depth, memory utilization, WebSocket status
    - Create `ResourceGauge` components for CPU, memory, network with color thresholds
    - Implement degradation alert display when deviation > 2 standard deviations from baseline
    - Show service connectivity alerts identifying affected service and time since last communication
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 5.3 Write property tests for agent monitoring
    - **Property 7: Unresponsive Agent Detection** - Verify (currentTime - lastHeartbeat) > 30000 triggers warning
    - **Property 25: Degradation Alert Threshold** - Verify |value - mean| > 2*stdDev triggers alert
    - **Validates: Requirements 4.4, 12.2**


- [ ] 6. Task Submission View
  - [ ] 6.1 Implement Task Panel with multilingual input
    - Create `TaskView` component with text input area (up to 10,000 characters)
    - Implement RTL layout switch when Arabic/Hebrew/Farsi selected (text alignment, cursor direction)
    - Implement auto-detection of dominant script direction for input text
    - Add syntax highlighting for code snippets within input
    - Add pending status indicator after submission until acknowledgment received
    - Display clarifying questions inline with selectable options and free-text reply
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ] 6.2 Implement task history panel
    - Create task history list with timestamps, status indicators, chronological ordering (newest first)
    - Add resubmit and modify actions for previous tasks
    - Preserve original language of user input alongside any processed versions
    - _Requirements: 2.5, 15.5_

  - [ ]* 6.3 Write property tests for text direction and preservation
    - **Property 4: Script Direction Detection** - Verify RTL detection for Arabic/Hebrew/Farsi dominant text
    - **Property 29: Input Text Preservation** - Verify byte-for-byte identity of stored input text
    - **Validates: Requirements 2.6, 15.5**

- [ ] 7. DAG Visualization View
  - [ ] 7.1 Implement React Flow canvas with custom DAG nodes and edges
    - Create `DAGView` component using React Flow library
    - Implement custom `DAGNode` component with status-colored icons (pending/running/completed/failed/recovering)
    - Implement custom `DAGEdge` component with critical path highlight style
    - Render dependency graph within 500ms of receiving decomposition plan
    - Implement real-time node status updates as subtasks execute
    - _Requirements: 3.1, 3.2, 3.4_


  - [ ] 7.2 Implement DAG interaction controls and detail panel
    - Add zoom, pan, and auto-layout controls (support up to 100 nodes)
    - Add touch gesture support (pinch-to-zoom, two-finger pan) for mobile
    - Create `NodeDetailPanel` showing subtask description, assigned agent, estimated/actual duration, output preview on node click
    - Animate wave transitions and display parallelism metrics (wall-clock vs. cumulative agent time)
    - _Requirements: 3.3, 3.5, 3.6, 14.4_

  - [ ]* 7.3 Write property tests for DAG visualization
    - **Property 5: Status-to-Color Mapping Consistency** - Verify same color returned for same status regardless of context
    - **Property 6: Critical Path Highlight Invariant** - Verify all critical path nodes/edges styled, no non-critical styled
    - **Validates: Requirements 3.2, 3.4, 13.5**

- [ ] 8. Checkpoint - Views 1-4 verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Performance Dashboard View
  - [ ] 9.1 Implement time-series charts with Recharts
    - Create `PerformanceView` component with time-series charts for execution time, throughput, error rate, resource utilization
    - Implement configurable time range selector (1h, 24h, 7d, 30d)
    - Add interactive tooltips on hover showing exact values, timestamps, contextual info
    - Highlight optimization-flagged operations with alert annotations
    - _Requirements: 5.1, 5.3, 5.5_


  - [ ] 9.2 Implement category breakdown and parallelism metrics
    - Create bar/pie charts showing task category breakdown with success rates, average duration, improvement trends
    - Create `ParallelismGauge` showing ratio of cumulative agent time to wall-clock time
    - Implement CSV data export for time-series datasets
    - _Requirements: 5.2, 5.4, 5.6_

  - [ ]* 9.3 Write property tests for performance data
    - **Property 11: CSV Export Round-Trip** - Verify export/parse produces equivalent dataset
    - **Validates: Requirements 5.6**

- [ ] 10. Skills Browser View
  - [ ] 10.1 Implement skill catalog with search, filter, and sort
    - Create `SkillsView` component with searchable, filterable catalog
    - Display each skill: name, categories, languages, confidence score, usage count, success rate
    - Implement search with results within 300ms and matched term highlighting
    - Implement sorting by confidence, usageCount, createdAt, successRate (asc/desc)
    - Implement filtering by categories, languages, minimum confidence
    - Display confidence as visual progress indicator with color coding (red<50%, yellow 50-80%, green>80%)
    - Show refinement badge on skills flagged for failure with link to failure analysis
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [ ] 10.2 Implement skill detail view
    - Create detail panel on skill selection showing description, solution template preview, version history timeline, usage statistics chart
    - _Requirements: 6.3_


  - [ ]* 10.3 Write property tests for skill filtering and sorting
    - **Property 13: Threshold-to-Color Mapping** - Verify confidence color bands (red<50, yellow 50-80, green>80)
    - **Validates: Requirements 6.4**

- [ ] 11. Memory Explorer View
  - [ ] 11.1 Implement namespace browser and paginated entry list
    - Create `MemoryView` component showing namespaces (project, patterns, preferences, decisions, lessons) with entry counts and storage utilization
    - On namespace selection, display paginated list (20 per page) with content preview, relevance score, access count, last accessed timestamp
    - Implement pagination controls with correct page slicing
    - _Requirements: 7.1, 7.2_

  - [ ] 11.2 Implement semantic search and entry detail view
    - Create semantic search interface querying Memory_Store with results ranked by relevance within 1 second
    - Create entry detail view showing full content, metadata tags, task reference, related entries
    - Visualize relevance-decay status with decay indicator (active/decaying/near-archival)
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ]* 11.3 Write property tests for memory operations
    - **Property 17: Search Results Ranked by Relevance** - Verify descending relevance score order
    - **Validates: Requirements 7.3**

- [ ] 12. Timeline View
  - [ ] 12.1 Implement chronological timeline with commits and checkpoints
    - Create `TimelineView` component showing chronological timeline of checkpoints and commits with task references, change summaries, timestamps
    - Visually distinguish checkpoints from commits using distinct icons and colors
    - Display branch information with visual branching and merging paths
    - _Requirements: 8.1, 8.3, 8.5_


  - [ ] 12.2 Implement commit detail and rollback functionality
    - On commit selection, display full diff (affected files, lines added/removed, reasoning context)
    - On checkpoint selection, show rollback action button
    - Implement rollback confirmation dialog listing files to be reverted and potential conflicts
    - _Requirements: 8.2, 8.4, 8.6_

  - [ ]* 12.3 Write property tests for timeline visuals
    - **Property 19: Timeline Type-to-Visual Mapping** - Verify checkpoint/commit get correct icons/colors
    - **Validates: Requirements 8.3**

- [ ] 13. Checkpoint - Views 5-8 verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Quality Review Panel
  - [ ] 14.1 Implement quality issues display with filtering
    - Create `QualityView` showing recent review results organized by severity (errors, warnings, info) with counts and overall quality score
    - On issue selection, display location (file, line), description, category (lint/type/pattern/security/performance), remediation
    - Display quality metrics as visual gauges: lint score, type check status, test coverage, cyclomatic complexity, documentation coverage
    - Implement filtering by category, severity, or affected file
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ] 14.2 Implement rework status before/after view
    - Display rework status when Quality_Assurer returns code to agent
    - Show before/after comparison view of the code
    - _Requirements: 9.4_


  - [ ]* 14.3 Write property tests for quality filtering
    - **Property 20: Quality Issues Group-by-Severity** - Verify correct grouping, counts sum, no duplicates
    - **Property 21: Quality Issue Filtering** - Verify inclusive/exclusive filter correctness
    - **Validates: Requirements 9.1, 9.5**

- [ ] 15. Recovery Log View
  - [ ] 15.1 Implement error log and escalation display
    - Create `RecoveryView` with chronological error list (timestamp, error type, affected agent/task, recovery status)
    - On error selection, display full detail: stack trace, input state, execution history, strategy used, attempts
    - Display escalation alerts prominently at top with diagnostic summary and recommended actions
    - Display degradation alerts with affected metrics and corrective actions
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [ ] 15.2 Implement recovery statistics display
    - Show recovery success statistics: percentage auto-recovered vs. escalated over configurable time periods
    - _Requirements: 10.4_

  - [ ]* 15.3 Write property tests for recovery statistics
    - **Property 22: Recovery Statistics Integrity** - Verify autoRecovered + escalated + pending = 100%
    - **Validates: Requirements 10.4**

- [ ] 16. Feedback Interface View
  - [ ] 16.1 Implement output review with accept/reject/correct
    - Create `FeedbackView` showing agent outputs with inline accept/reject controls
    - Implement correction submission with diff view comparing original vs corrected
    - Support annotated corrections with section highlighting and explanatory comments
    - _Requirements: 11.1, 11.2, 11.5_


  - [ ] 16.2 Implement acceptance rate tracking and improvement notices
    - Display historical acceptance rate per task category as summary
    - Show improvement notice with trend chart when category acceptance rate < 70%
    - _Requirements: 11.3, 11.4_

  - [ ]* 16.3 Write property tests for feedback and diff
    - **Property 23: Diff Computation Correctness** - Verify applying diff to original produces corrected string
    - **Property 24: Acceptance Rate and Threshold Notice** - Verify rate calculation and <70% notice trigger
    - **Validates: Requirements 11.2, 11.3, 11.4**

- [ ] 17. Settings View
  - [ ] 17.1 Implement settings panel
    - Create `SettingsView` with theme toggle (dark/light with 300ms transition)
    - Add language selector (English/Arabic) with instant switch (no page reload, within 500ms)
    - Add keyboard shortcuts reference display
    - Add WebSocket connection settings (URL configuration)
    - _Requirements: 13.2, 15.3, 16.5_

- [ ] 18. Checkpoint - All views verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Cross-Cutting Concerns and Polish
  - [ ] 19.1 Implement global notification system
    - Wire high-priority WebSocket events (escalations, degradation warnings, task completions) to global notification store
    - Display notifications regardless of current active view in the TopBar NotificationArea
    - Add dismiss action for individual notifications
    - _Requirements: 16.3_


  - [ ] 19.2 Implement responsive design and mobile optimizations
    - Verify all views adapt to viewport widths 320px-2560px without overflow
    - Ensure touch-friendly tap targets (min 44x44px) on mobile
    - Ensure 30fps on mobile, 60fps on desktop during animations
    - Test hamburger menu on <768px, collapsible sidebar on ≥768px
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

  - [ ] 19.3 Implement full RTL layout mirroring
    - Mirror entire layout for RTL locales (navigation placement, text alignment, icon positions, component ordering)
    - Handle mixed-direction content (Arabic text with English code) using Unicode bidi algorithm
    - Verify all 12 views render correctly in RTL mode
    - _Requirements: 15.1, 15.2_

  - [ ]* 19.4 Write property tests for theme and i18n
    - **Property 26: Theme Contrast and Luminance** - Verify dark background luminance < 0.15, contrast ratio >= 4.5:1
    - **Property 27: RTL Locale Direction Mapping** - Verify ar/he/fa → rtl, others → ltr
    - **Property 28: Translation Key Completeness** - Verify all keys exist in both en and ar bundles
    - **Validates: Requirements 13.1, 15.1, 15.4**

  - [ ]* 19.5 Write property tests for notifications and shortcuts
    - **Property 30: Global Notification Routing** - Verify high-priority alerts create notifications regardless of active view
    - **Property 31: Keyboard Shortcut Dispatch** - Verify registered shortcuts dispatch exactly once, unregistered do nothing
    - **Validates: Requirements 16.3, 16.5**

- [ ] 20. Final Checkpoint - Complete integration verification
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 31 universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout as specified in the design
- All views share a common design system (colors, spacing, typography, animations)
- WebSocket communication layer is foundational — must work before view implementation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2", "2.3"] },
    { "id": 5, "tasks": ["2.4", "2.5"] },
    { "id": 6, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 7, "tasks": ["4.5", "4.6"] },
    { "id": 8, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 9, "tasks": ["5.2", "6.2", "7.2"] },
    { "id": 10, "tasks": ["5.3", "6.3", "7.3"] },
    { "id": 11, "tasks": ["9.1", "10.1", "11.1", "12.1"] },
    { "id": 12, "tasks": ["9.2", "10.2", "11.2", "12.2"] },
    { "id": 13, "tasks": ["9.3", "10.3", "11.3", "12.3"] },
    { "id": 14, "tasks": ["14.1", "15.1", "16.1"] },
    { "id": 15, "tasks": ["14.2", "15.2", "16.2", "17.1"] },
    { "id": 16, "tasks": ["14.3", "15.3", "16.3"] },
    { "id": 17, "tasks": ["19.1", "19.2", "19.3"] },
    { "id": 18, "tasks": ["19.4", "19.5"] }
  ]
}
```
