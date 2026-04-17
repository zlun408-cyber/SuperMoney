# Abnormal Fund Investigation View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an embedded abnormal-fund investigation view inside `/accuracy` that consolidates high-error, unresolved, and consecutive-bias anomalies into one sortable list.

**Architecture:** Reuse the existing estimate-accuracy snapshots and diagnostics pipeline, but add one focused domain helper that aggregates anomalies into a single normalized list with severity ordering and concise investigation hints. The dashboard then renders that list as a new section without changing the rest of the accuracy flow.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library

---

### Task 1: Add abnormal investigation aggregation helper

**Files:**
- Create: `lib/funds/estimate-accuracy-abnormal-investigation.ts`
- Create: `tests/lib/funds/estimate-accuracy-abnormal-investigation.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Render the abnormal investigation section in `/accuracy`

**Files:**
- Modify: `components/accuracy/accuracy-dashboard.tsx`
- Modify: `tests/components/accuracy/accuracy-dashboard.test.tsx`

- [ ] **Step 1: Write the failing dashboard test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 3: Focused verification

**Files:**
- Verify: `tests/lib/funds/estimate-accuracy-abnormal-investigation.test.ts`
- Verify: `tests/components/accuracy/accuracy-dashboard.test.tsx`

- [ ] **Step 1: Run focused test commands**
- [ ] **Step 2: Confirm no regressions in the existing accuracy dashboard flows**
