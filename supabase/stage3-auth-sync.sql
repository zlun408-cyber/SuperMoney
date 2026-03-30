create extension if not exists pgcrypto;

create table if not exists public.watchlist_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.fund_transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_id uuid not null references public.watchlist_funds(id) on delete cascade,
  type text not null check (type in ('buy', 'sell', 'cash_dividend', 'reinvest_dividend')),
  trade_date date not null,
  amount numeric(18, 4),
  shares numeric(18, 4),
  nav numeric(18, 6),
  fee numeric(18, 4),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fund_sip_plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_id uuid not null references public.watchlist_funds(id) on delete cascade,
  name text,
  amount numeric(18, 4) not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  start_date date not null,
  end_date date,
  execution_time text not null,
  execution_period text not null check (execution_period in ('before_1500', 'after_1500')),
  status text not null check (status in ('active', 'paused', 'ended')),
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchlist_funds_user_id_idx on public.watchlist_funds(user_id);
create index if not exists fund_transactions_user_id_idx on public.fund_transactions(user_id);
create index if not exists fund_transactions_fund_id_idx on public.fund_transactions(fund_id);
create index if not exists fund_sip_plans_user_id_idx on public.fund_sip_plans(user_id);
create index if not exists fund_sip_plans_fund_id_idx on public.fund_sip_plans(fund_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fund_transactions_set_updated_at on public.fund_transactions;
drop trigger if exists fund_sip_plans_set_updated_at on public.fund_sip_plans;

create trigger fund_transactions_set_updated_at
before update on public.fund_transactions
for each row
execute function public.set_updated_at();

create trigger fund_sip_plans_set_updated_at
before update on public.fund_sip_plans
for each row
execute function public.set_updated_at();

alter table public.watchlist_funds enable row level security;
alter table public.fund_transactions enable row level security;
alter table public.fund_sip_plans enable row level security;

drop policy if exists "watchlist_funds_select_own" on public.watchlist_funds;
create policy "watchlist_funds_select_own"
on public.watchlist_funds
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "watchlist_funds_insert_own" on public.watchlist_funds;
create policy "watchlist_funds_insert_own"
on public.watchlist_funds
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "watchlist_funds_update_own" on public.watchlist_funds;
create policy "watchlist_funds_update_own"
on public.watchlist_funds
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "watchlist_funds_delete_own" on public.watchlist_funds;
create policy "watchlist_funds_delete_own"
on public.watchlist_funds
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_transactions_select_own" on public.fund_transactions;
create policy "fund_transactions_select_own"
on public.fund_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_transactions_insert_own" on public.fund_transactions;
create policy "fund_transactions_insert_own"
on public.fund_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "fund_transactions_update_own" on public.fund_transactions;
create policy "fund_transactions_update_own"
on public.fund_transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "fund_transactions_delete_own" on public.fund_transactions;
create policy "fund_transactions_delete_own"
on public.fund_transactions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_sip_plans_select_own" on public.fund_sip_plans;
create policy "fund_sip_plans_select_own"
on public.fund_sip_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fund_sip_plans_insert_own" on public.fund_sip_plans;
create policy "fund_sip_plans_insert_own"
on public.fund_sip_plans
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "fund_sip_plans_update_own" on public.fund_sip_plans;
create policy "fund_sip_plans_update_own"
on public.fund_sip_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "fund_sip_plans_delete_own" on public.fund_sip_plans;
create policy "fund_sip_plans_delete_own"
on public.fund_sip_plans
for delete
to authenticated
using (auth.uid() = user_id);
