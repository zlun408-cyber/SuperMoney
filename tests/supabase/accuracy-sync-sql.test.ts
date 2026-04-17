import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sqlPath = path.resolve(process.cwd(), 'supabase/accuracy-sync.sql');

const loadSql = () => readFileSync(sqlPath, 'utf8');

describe('accuracy-sync SQL migration', () => {
  it('creates the accuracy snapshot and adjustment decision tables', () => {
    const sql = loadSql();

    expect(sql).toContain('create table if not exists public.fund_estimate_accuracy_snapshots');
    expect(sql).toContain('create table if not exists public.fund_estimate_adjustment_decisions');
    expect(sql).toContain('unique (user_id, snapshot_key)');
    expect(sql).toContain('unique (user_id, fund_code)');
    expect(sql).toContain("quote_time_semantics in ('china_local', 'absolute')");
    expect(sql).toContain("status in ('verification', 'watch', 'dismissed', 'validated', 'failed')");
  });

  it('defines indexes and updated_at triggers for both tables', () => {
    const sql = loadSql();

    expect(sql).toContain('create index if not exists fund_estimate_accuracy_snapshots_user_fund_date_idx');
    expect(sql).toContain('create index if not exists fund_estimate_accuracy_snapshots_user_quote_updated_at_idx');
    expect(sql).toContain('create index if not exists fund_estimate_adjustment_decisions_user_status_idx');
    expect(sql).toContain('create index if not exists fund_estimate_adjustment_decisions_user_decision_updated_at_idx');
    expect(sql).toContain('drop trigger if exists fund_estimate_accuracy_snapshots_set_updated_at on public.fund_estimate_accuracy_snapshots;');
    expect(sql).toContain('drop trigger if exists fund_estimate_adjustment_decisions_set_updated_at on public.fund_estimate_adjustment_decisions;');
    expect(sql).toContain('create trigger fund_estimate_accuracy_snapshots_set_updated_at');
    expect(sql).toContain('create trigger fund_estimate_adjustment_decisions_set_updated_at');
  });

  it('enables RLS and declares CRUD policies for both tables', () => {
    const sql = loadSql();

    expect(sql).toContain('alter table public.fund_estimate_accuracy_snapshots enable row level security;');
    expect(sql).toContain('alter table public.fund_estimate_adjustment_decisions enable row level security;');

    expect(sql).toContain('create policy "fund_estimate_accuracy_snapshots_select_own"');
    expect(sql).toContain('create policy "fund_estimate_accuracy_snapshots_insert_own"');
    expect(sql).toContain('create policy "fund_estimate_accuracy_snapshots_update_own"');
    expect(sql).toContain('create policy "fund_estimate_accuracy_snapshots_delete_own"');

    expect(sql).toContain('create policy "fund_estimate_adjustment_decisions_select_own"');
    expect(sql).toContain('create policy "fund_estimate_adjustment_decisions_insert_own"');
    expect(sql).toContain('create policy "fund_estimate_adjustment_decisions_update_own"');
    expect(sql).toContain('create policy "fund_estimate_adjustment_decisions_delete_own"');
  });
});
