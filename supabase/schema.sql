create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
drop function if exists public.create_profile_for_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

drop table if exists public.budgets cascade;
drop table if exists public.transactions cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  name_key text generated always as (lower(btrim(name))) stored,
  type text not null check (type in ('income', 'expense')),
  color text not null default '#10b981',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  notes text,
  transaction_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'whatsapp')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  period text not null default 'monthly' check (period in ('weekly', 'monthly')),
  spent numeric(14, 2) not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_user_type_name_key_idx
  on public.categories (user_id, type, name_key);

create index categories_user_type_idx
  on public.categories (user_id, type);

create index transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc)
  where deleted_at is null;

create index transactions_user_category_idx
  on public.transactions (user_id, category_id)
  where deleted_at is null;

create index budgets_user_category_idx
  on public.budgets (user_id, category_id)
  where archived_at is null;

create index budgets_user_period_idx
  on public.budgets (user_id, period)
  where archived_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger set_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.categories (user_id, name, type, color)
  values
    (new.id, 'Makan', 'expense', '#10b981'),
    (new.id, 'Transport', 'expense', '#14b8a6'),
    (new.id, 'Tagihan', 'expense', '#f59e0b'),
    (new.id, 'Belanja', 'expense', '#ef4444'),
    (new.id, 'Gaji', 'income', '#22c55e'),
    (new.id, 'Freelance', 'income', '#06b6d4')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read own categories"
on public.categories for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own categories"
on public.categories for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own categories"
on public.categories for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own categories"
on public.categories for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own transactions"
on public.transactions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own transactions"
on public.transactions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own transactions"
on public.transactions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own transactions"
on public.transactions for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own budgets"
on public.budgets for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own budgets"
on public.budgets for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own budgets"
on public.budgets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own budgets"
on public.budgets for delete
to authenticated
using (auth.uid() = user_id);
