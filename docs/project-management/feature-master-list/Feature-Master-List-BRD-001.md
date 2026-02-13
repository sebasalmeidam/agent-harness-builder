# Feature Master List

**Source BRD**: .dev-docs/BRD.md
**Created**: 2026-02-13
**Rule**: Each feature must be an end-to-end vertical slice. Features are grouped into slices for PRD creation. One PRD per slice, not necessarily one PRD per feature.

## Features

- [ ] **Feature 1: Application Foundation and Dev Environment**
  - BRD Reference: Section 3.6 (BR-3.6.1, BR-3.6.2, BR-3.6.3), NFR-4.4, NFR-4.5
  - Slice: Slice 1
  - PRD: [pending]

- [ ] **Feature 2: Team CRUD and Persistence**
  - BRD Reference: Section 3.1 (BR-3.1.1, BR-3.1.7), Section 3.5 (BR-3.5.1)
  - Slice: Slice 2
  - PRD: [pending]

- [ ] **Feature 3: Visual Canvas with Agent Nodes**
  - BRD Reference: Section 3.1 (BR-3.1.2, BR-3.1.3, BR-3.1.8)
  - Slice: Slice 2
  - PRD: [pending]

- [ ] **Feature 4: Workflow Edges and Gates**
  - BRD Reference: Section 3.1 (BR-3.1.4, BR-3.1.5, BR-3.1.6)
  - Slice: Slice 2
  - PRD: [pending]

- [ ] **Feature 5: Harness Extraction and Loading**
  - BRD Reference: Section 3.2 (BR-3.2.1, BR-3.2.2, BR-3.2.3, BR-3.2.4), NFR-4.3
  - Slice: Slice 3
  - PRD: [pending]

- [ ] **Feature 6: Project Management**
  - BRD Reference: Section 3.3 (BR-3.3.1, BR-3.3.2, BR-3.3.3, BR-3.3.4, BR-3.3.5), Section 3.5 (BR-3.5.2)
  - Slice: Slice 4
  - PRD: [pending]

- [ ] **Feature 7: Execution Trigger and Runtime Translation**
  - BRD Reference: Section 3.4 (BR-3.4.1, BR-3.4.2)
  - Slice: Slice 5
  - PRD: [pending]

- [ ] **Feature 8: Execution Monitoring**
  - BRD Reference: Section 3.4 (BR-3.4.3, BR-3.4.4, BR-3.4.5, BR-3.4.6)
  - Slice: Slice 5
  - PRD: [pending]

- [ ] **Feature 9: Execution History**
  - BRD Reference: Section 3.4 (BR-3.4.7), Section 3.5 (BR-3.5.2)
  - Slice: Slice 5
  - PRD: [pending]

**Note on Feature 10 (Responsive UI and Error Handling):** Feature 10 was dissolved during validation. NFR-4.1 (responsive desktop UI) and NFR-4.2 (graceful error handling) are cross-cutting non-functional requirements, not a vertical slice. They are distributed as acceptance criteria across Slices 2, 4, and 5 -- every slice with UI components must meet these standards.

## Slices

### Slice 1: Application Foundation
- **Features**: F1
- **BRD Sections**: 3.6 (BR-3.6.1, BR-3.6.2, BR-3.6.3), NFR-4.4, NFR-4.5
- **Why together**: Single feature that establishes the runnable monorepo skeleton, dev container, TypeScript configuration, and MIT license. Prerequisite for all other slices.
- **PRD**: [pending]

### Slice 2: Team Builder
- **Features**: F2, F3, F4
- **BRD Sections**: 3.1 (BR-3.1.1 through BR-3.1.8), 3.5 (BR-3.5.1), NFR-4.1, NFR-4.2
- **Why together**: These three features form the complete Team Design capability (BRD Section 3.1). They share the team data model, the canvas UI surface, and the team API routes. The canvas (F3) cannot be saved without CRUD (F2); edges and gates (F4) cannot exist without the canvas. High file overlap across all three would cause merge conflicts if split into separate slices.
- **PRD**: [pending]

### Slice 3: Harness System
- **Features**: F5
- **BRD Sections**: 3.2 (BR-3.2.1 through BR-3.2.4), NFR-4.3
- **Why together**: Standalone capability that bridges Team Builder and Execution. Has its own export/import logic, data format specification, versioning, and documentation.
- **PRD**: [pending]

### Slice 4: Project Management
- **Features**: F6
- **BRD Sections**: 3.3 (BR-3.3.1 through BR-3.3.5), 3.5 (BR-3.5.2), NFR-4.1, NFR-4.2
- **Why together**: Self-contained capability with its own UI views (dashboard, project editor), API routes, and JSON persistence. Connects to teams via assignment but is independently deployable.
- **PRD**: [pending]

### Slice 5: Execution Engine
- **Features**: F7, F8, F9
- **BRD Sections**: 3.4 (BR-3.4.1 through BR-3.4.7), 3.5 (BR-3.5.2, BR-3.5.3), NFR-4.1, NFR-4.2
- **Why together**: These three features form the complete Execution experience (BRD Section 3.4). The trigger (F7) produces execution runs; monitoring (F8) displays them in real-time; history (F9) stores and retrieves past runs. They share the execution data model, runtime package, execution API endpoints, and execution UI components.
- **PRD**: [pending]

### Slice Validation
- [x] Every feature belongs to exactly one slice
- [x] No feature is in multiple slices
- [x] No feature is unassigned (Feature 10 dissolved, its NFRs distributed)
- [x] Each slice is a coherent vertical capability

## Parallel Work Progress
*Launch one subagent task per each identified slice PRD*
**Phase 4 (PRD Creation)**: 0/5 complete
**Phase 5 (Tech Review)**: 0/5 complete
**Phase 6 (Individual BRD Validation)**: 0/5 complete
**Feature List Alignment Phase**: Pending (requires all Phase 6 complete)

## Feature List Validation
- [x] All BRD sections covered
- [x] Every feature is end-to-end
- [x] Each feature is independently deployable and valuable by itself
- [x] No features outside BRD scope
- [x] Logical ordering based on hard dependencies
