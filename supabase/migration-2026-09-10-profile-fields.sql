-- Migration: profile fields (address, age, gender)
-- Date: 2026-09-10
-- Safe to run more than once (idempotent).
--
-- Run in Supabase SQL Editor. It only touches public.profiles — no business
-- rows are modified, so the trg_status_team_only trigger is not involved.

-- 1) New nullable profile columns
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists age numeric;
alter table public.profiles add column if not exists gender text;

-- 2) Sensible defaults for existing rows (keeps NOT NULL-free schema; app
--    treats empty as "not filled in yet"). No-op for rows already set.
update public.profiles set address = '' where address is null;

-- 3) Basic sanity constraint on age (ignore errors if re-run)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_age_check'
  ) then
    alter table public.profiles add constraint profiles_age_check
      check (age is null or (age >= 1 and age <= 120));
  end if;
end $$;

-- 4) Confirm RLS is still on (should print rls = on)
select relname, relrowsecurity as rls from pg_class where relname = 'profiles';
