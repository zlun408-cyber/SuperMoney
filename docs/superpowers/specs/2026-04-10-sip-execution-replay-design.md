# SIP Execution Replay Design

## Goal
Implement minimal execution records for SIP plans so the backend can replay missed executions, mark deleted auto-generated transactions as `skipped`, and persist the same model locally and in Supabase.

## Scope
- Add execution record domain types and storage shape
- Expand SIP materialization logic from transaction-scan idempotency to execution-record-driven replay
- Persist execution records in local storage and Supabase
- Update delete semantics for auto-generated transactions so deleted executions do not get recreated
- Add unit tests covering replay, skipped behavior, and persistence mapping

## Key Decisions
- Execution uniqueness key is `planId + executionDate`
- Execution states are only `pending | generated | skipped`
- Failed generation attempts remain `pending`
- Deleting a generated SIP transaction moves the execution record to `skipped`
- Cloud and local storage share the same execution record shape to avoid divergent behavior

## Backend Design
- `lib/funds/types.ts` defines `SipExecutionStatus` and `SipExecutionRecord`
- `lib/funds/sip-plans.ts` accepts execution records alongside plans and transactions, ensures missing due executions become `pending`, and transitions `pending -> generated` on successful transaction creation
- New helper functions in the SIP domain handle ensure/find/mark-generated/mark-skipped transitions with stable ids and timestamps
- The materialize result includes updated execution records in addition to updated plans and created transactions

## Persistence Design
- `lib/storage/watchlist-storage.ts` stores `sipExecutionRecords` on each fund and keeps backward compatibility for old local payloads
- `lib/sync/cloud-watchlist.ts` adds `fund_sip_executions` rows, list/replace methods, and mapping from cloud rows back into local watchlist funds
- `supabase/stage3-auth-sync.sql` adds the `fund_sip_executions` table, constraints, indexes, trigger, and RLS policies

## Delete Semantics
- Auto-generated transactions remain identified by `source = 'sip_plan'` and `sourcePlanId`
- Backend delete handling must locate the execution record for the transaction's `planId + placedDate`
- That record transitions from `generated` to `skipped`, clears `transactionId`, and records `skippedAt`/`skipReason`
- Future replay leaves `skipped` unchanged

## Testing Strategy
- Add failing tests first for:
  - due execution creates `pending` then `generated`
  - replay of `pending` creates missing transaction later
  - `generated` executions do not duplicate transactions
  - `skipped` executions do not regenerate
  - local/cloud persistence mapping includes execution records
- Keep tests unit-level and focused on pure domain/storage helpers where possible
