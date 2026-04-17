create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.fund_estimate_accuracy_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_key text not null,
  fund_code text not null,
  fund_name text not null,
  quote_updated_at timestamptz not null,
  quote_updated_at_raw text not null,
  quote_time_semantics text not null check (quote_time_semantics in ('china_local', 'absolute')),
  trading_date date not null,
  estimated_nav numeric(18, 6) not null,
  final_nav numeric(18, 6),
  absolute_error_rate numeric(12, 8) check (absolute_error_rate is null or absolute_error_rate >= 0),
  resolved_at timestamptz,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_key)
);

create table if not exists public.fund_estimate_adjustment_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_code text not null,
  fund_name text,
  status text not null check (status in ('verification', 'watch', 'dismissed', 'validated', 'failed')),
  decision_updated_at timestamptz not null,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fund_code)
);

create index if not exists fund_estimate_accuracy_snapshots_user_fund_date_idx
on public.fund_estimate_accuracy_snapshots(user_id, fund_code, trading_date desc);

create index if not exists fund_estimate_accuracy_snapshots_user_quote_updated_at_idx
on public.fund_estimate_accuracy_snapshots(user_id, quote_updated_at desc);

create index if not exists fund_estimate_accuracy_snapshots_user_resolved_at_idx
on public.fund_estimate_accuracy_snapshots(user_id, resolved_at desc)
where resolved_at is not null;

create index if not exists fund_estimate_adjustment_decisions_user_status_idx
on public.fund_estimate_adjustment_decisions(user_id, status);

create index if not exists fund_estimate_adjustment_decisions_user_decision_updated_at_idx
on public.fund_estimate_adjustment_decisions(user_id, decision_updated_at desc);

drop trigger if exists fund_estimate_accuracy_snapshots_set_updated_at on public.fund_estimate_accuracy_snapshots;
drop trigger if exists fund_estimate_adjustment_decisions_set_updated_at on public.fund_estimate_adjustment_decisions;

create trigger fund_estimate_accuracy_snapshots_set_updated_at
before update on public.fund_estimate_accuracy_snapshots
for each row
execute function public.set_updated_at();

create trigger fund_estimate_adjustment_decisions_set_updated_at
before update on public.fund_estimate_adjustment_decisions
for each row
execute function public.set_updated_at();

alter table public.fund_estimate_accuracy_snapshots enable row level security;
alter table public.fund_estimate_adjustment_decisions enable row level security;

drop policy if exists "fund_estimate_accuracy_snapshots_select_own" on public.fund_estimate_accuracy_snapshots;
create policy "fund_estimate_accuracy_snapshots_select_own"
on public.fund_estimate_accuracy_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_estimate_accuracy_snapshots_insert_own" on public.fund_estimate_accuracy_snapshots;
create policy "fund_estimate_accuracy_snapshots_insert_own"
on public.fund_estimate_accuracy_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "fund_estimate_accuracy_snapshots_update_own" on public.fund_estimate_accuracy_snapshots;
create policy "fund_estimate_accuracy_snapshots_update_own"
on public.fund_estimate_accuracy_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "fund_estimate_accuracy_snapshots_delete_own" on public.fund_estimate_accuracy_snapshots;
create policy "fund_estimate_accuracy_snapshots_delete_own"
on public.fund_estimate_accuracy_snapshots
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_estimate_adjustment_decisions_select_own" on public.fund_estimate_adjustment_decisions;
create policy "fund_estimate_adjustment_decisions_select_own"
on public.fund_estimate_adjustment_decisions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_estimate_adjustment_decisions_insert_own" on public.fund_estimate_adjustment_decisions;
create policy "fund_estimate_adjustment_decisions_insert_own"
on public.fund_estimate_adjustment_decisions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "fund_estimate_adjustment_decisions_update_own" on public.fund_estimate_adjustment_decisions;
create policy "fund_estimate_adjustment_decisions_update_own"
on public.fund_estimate_adjustment_decisions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "fund_estimate_adjustment_decisions_delete_own" on public.fund_estimate_adjustment_decisions;
create policy "fund_estimate_adjustment_decisions_delete_own"
on public.fund_estimate_adjustment_decisions
for delete
to authenticated
using (auth.uid() = user_id);
