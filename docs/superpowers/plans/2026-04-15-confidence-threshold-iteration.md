# Confidence Threshold Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade fund-detail confidence grading from a single sample-count/error threshold to a conservative layered model based on trading-day coverage, resolved sample volume, and high-error share.

**Architecture:** Keep the change inside the existing estimate-accuracy domain. Extend `EstimateAccuracySummary` so the domain summary carries the extra evidence needed for grading, then update `gradeEstimateConfidence` to combine average-error gating with the weakest of the three new confidence dimensions. The detail page continues to consume the same grading function without new UI chrome.

**Tech Stack:** TypeScript, React, Vitest

---

### Task 1: Extend estimate accuracy summary and confidence grading

**Files:**
- Modify: `lib/funds/types.ts`
- Modify: `lib/funds/estimate-accuracy.ts`
- Modify: `tests/lib/funds/estimate-accuracy.test.ts`

- [ ] **Step 1: Write failing tests for trading-day coverage, sample-volume, and high-error-share gating**
- [ ] **Step 2: Run `npm test -- --run tests/lib/funds/estimate-accuracy.test.ts` and confirm it fails for the new scenarios**
- [ ] **Step 3: Implement the minimal summary fields and layered confidence grading logic**
- [ ] **Step 4: Re-run `npm test -- --run tests/lib/funds/estimate-accuracy.test.ts` and confirm it passes**

### Task 2: Keep detail-page integration compatible

**Files:**
- Modify: `components/fund/fund-detail-content.tsx`
- Modify: `tests/components/fund/estimate-confidence-panel.test.tsx`
- Modify: `tests/components/fund/fund-detail-content.test.tsx`

- [ ] **Step 1: Update summary fixtures / empty-state summary shape as needed**
- [ ] **Step 2: Run the focused detail-page tests and confirm any breakage is type- or fixture-related only**
- [ ] **Step 3: Apply the minimal compatibility fixes**
- [ ] **Step 4: Re-run focused detail-page tests and confirm they pass**

### Task 3: Focused verification

**Files:**
- Verify: `tests/lib/funds/estimate-accuracy.test.ts`
- Verify: `tests/components/fund/estimate-confidence-panel.test.tsx`
- Verify: `tests/components/fund/fund-detail-content.test.tsx`

- [ ] **Step 1: Run the combined focused test command**
- [ ] **Step 2: Confirm the confidence iteration changes only affect grading behavior and do not regress detail-page rendering**
