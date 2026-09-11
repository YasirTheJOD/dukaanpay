-- ============================================================
-- DUKAANPAY — Security fixes (run in Supabase SQL Editor)
-- Fixes:
--   (a) cross-tenant RLS hole (signups got team-level access)
--   (b) owners could self-approve their shop status (and insert
--       a shop directly as 'approved')
--   (c) dead notification link '/business'
--   (d) redundant bills.order_id trigger
--
-- IMPORTANT: Supabase runs each "Run" as ONE transaction, and Postgres
-- forbids using a newly-added enum value in the same transaction it was
-- added in. So run the three STEP blocks below as three separate Runs,
-- in order. Every statement is idempotent (safe to re-run).
--
-- NOTE: RLS policies cannot restrict WHICH columns an UPDATE may change,
-- so fix (b) is enforced by the trg_status_team_only trigger below, which
-- works on every code path (REST, SQL editor, future features).
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1 — run this block alone, then continue to STEP 2
-- ------------------------------------------------------------
alter type public.user_role add value if not exists 'user' after 'staff';

-- ------------------------------------------------------------
-- STEP 2 — functions, policies, triggers, notification links
-- ------------------------------------------------------------

-- (a) New signups become 'user' (ordinary shop-owner account), never 'staff'.
--     Team roles are granted manually by the Lead Owner in the admin Team page.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (a) The column default must match: any future insert that omits role
--     must produce an ordinary user, never a team member.
alter table public.profiles alter column role set default 'user';

-- (b) Owners can edit their own shop, but the status COLUMN is guarded by the
--     trg_status_team_only trigger below, so owners can never self-approve.
drop policy if exists "owner update own shop" on public.businesses;
create policy "owner update own shop" on public.businesses
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "team update status" on public.businesses;
drop policy if exists "team update shops" on public.businesses;
create policy "team update shops" on public.businesses
  for update using (public.is_team());

-- (b) Defense in depth: only the DukaanPay team can change status, and new
--     shops always start as 'pending' — on every code path.
create or replace function public.enforce_status_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' and public.is_team() is not true then
      raise exception 'New shops must start as pending; only the DukaanPay team can set status';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and public.is_team() is not true then
    raise exception 'Only the DukaanPay team can change business status';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_status_team_only on public.businesses;
create trigger trg_status_team_only
  before insert or update on public.businesses
  for each row execute function public.enforce_status_rules();

-- (c) Fix the dead '/business' link: existing rows and the trigger itself.
update public.notifications set link = '/app' where link = '/business';

create or replace function public.notify_owner_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text; b text;
begin
  if new.status <> old.status then
    select name into b from public.businesses where id = new.id;
    if new.status = 'approved' then
      t := 'Shop approved 🎉';
    elsif new.status = 'rejected' then
      t := 'Shop request rejected';
    elsif new.status = 'suspended' then
      t := 'Shop suspended';
    end if;
    insert into public.notifications (user_id, title, body, link)
    values (new.owner_id, t, b || ' — status updated to ' || new.status::text || '.', '/app');
  end if;
  return new;
end;
$$;

-- (d) The unique constraint on bills.order_id already enforces uniqueness;
--     this trigger only duplicated it.
drop trigger if exists trg_unique_order_id on public.bills;
drop function if exists public.enforce_unique_order_suffix();

-- ------------------------------------------------------------
-- STEP 3 — run this block alone, after STEP 1 has committed
-- (a) Demote every existing account that was auto-assigned 'staff'.
--     ⚠ This includes any REAL team members you promoted. If you have
--     any, re-promote them afterwards (admin Team page, or:
--     update public.profiles set role = 'staff' where id = '<uuid>';
-- ------------------------------------------------------------
update public.profiles set role = 'user' where role = 'staff';
