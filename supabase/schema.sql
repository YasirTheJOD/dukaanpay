-- ============================================================
-- DUKAANPAY — Database Schema (run in Supabase SQL Editor)
-- Multi-tenant billing platform for local Indian shops.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
create type user_role as enum ('owner', 'manager', 'staff', 'user');
create type business_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type ticket_status as enum ('open', 'answered', 'closed');

-- ---------- PROFILES (mirrors auth.users 1:1) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  address text not null default '',
  age numeric check (age is null or (age >= 1 and age <= 120)),
  gender text,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a user signs up.
-- New signups get role 'user' (ordinary shop-owner account); team roles
-- (owner/manager/staff) are granted manually by the Lead Owner in the admin Team page.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, address, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    '',
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user DukaanPay team (owner/manager/staff)?
-- NOTE: role 'user' = ordinary signup, NOT team. Only the three explicit team
-- roles below count; team membership is granted manually by the Lead Owner.
create or replace function public.is_team()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner','manager','staff')
  );
$$;

create or replace function public.is_lead_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- ---------- BUSINESS CATEGORIES (business type / work type) ----------
create table public.business_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.business_categories (name) values
  ('Kirana / Grocery'), ('Mobile & Electronics Repair'), ('Salon & Grooming'),
  ('Tailoring'), ('Restaurant / Food Stall'), ('Stationery & Xerox'),
  ('Auto Repair / Garage'), ('Hardware & Paints'), ('Pharmacy / Medical'),
  ('Clothing & Footwear'), ('Electrical & Plumbing Services'), ('Other');

-- ---------- BUSINESSES (shops) ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  business_type text not null default '',
  work_type text not null default '',
  shop_phone text not null default '',
  shop_email text not null default '',
  address text not null default '',
  owner_name text not null default '',
  owner_phone text not null default '',
  owner_email text not null default '',
  shop_logo_url text,
  owner_photo_url text,
  status business_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.businesses (owner_id);
create index on public.businesses (status);

-- ---------- ITEM CATEGORIES (product/service categories per business) ----------
create table public.item_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

-- ---------- ITEMS (products & services) ----------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  kind text not null default 'product' check (kind in ('product','service')),
  base_unit text not null default 'piece',
  base_qty numeric not null default 1 check (base_qty > 0),
  price numeric not null default 0 check (price >= 0),
  category_id uuid references public.item_categories(id) on delete set null,
  image_url text,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.items (business_id);
create index on public.items (business_id, use_count desc);

-- ---------- BILLS ----------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id text not null unique,                    -- DDMMYYXXX
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]',                -- snapshot of billed lines
  labor_charge numeric not null default 0,
  total_amount numeric not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.bills (business_id, created_at desc);

-- order_id uniqueness is enforced by the unique constraint on bills.order_id above.

-- ---------- NOTIFICATIONS (in-app; email/SMS can hook later) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.notifications (user_id, created_at desc);

-- Notify team when a shop request arrives
create or replace function public.notify_team_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, title, body, link)
    select p.id, 'New shop request',
           (select name from public.businesses where id = new.id) || ' has applied for approval.',
           '/admin/businesses'
    from public.profiles p where p.role in ('owner','manager','staff');
  end if;
  return new;
end;
$$;
create trigger trg_notify_team_request
  after insert on public.businesses
  for each row execute function public.notify_team_new_request();

-- Notify shop owner when their shop is approved / rejected / suspended
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
create trigger trg_notify_status
  after update on public.businesses
  for each row execute function public.notify_owner_status_change();

-- ---------- SUPPORT TICKETS ----------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.support_tickets (user_id);
create index on public.support_messages (ticket_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.item_categories enable row level security;
alter table public.items enable row level security;
alter table public.bills enable row level security;
alter table public.notifications enable row level security;
alter table public.business_categories enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- PROFILES: users see/update self; team sees all; only lead owner changes roles
create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_team());
create policy "update own profile" on public.profiles for update using (id = auth.uid());
create policy "team manage profiles" on public.profiles for update using (public.is_lead_owner());

-- BUSINESS CATEGORIES: readable by everyone signed in
create policy "read categories" on public.business_categories for select using (auth.uid() is not null);
create policy "lead owner manages categories" on public.business_categories for all using (public.is_lead_owner());

-- BUSINESSES: owner sees own; team sees all; owner can create (pending); team updates status
create policy "owner read own shops" on public.businesses for select using (owner_id = auth.uid() or public.is_team());
create policy "owner create shop" on public.businesses for insert with check (owner_id = auth.uid());
-- Owners can edit their own shop, but the status COLUMN is guarded by the
-- trg_status_team_only trigger below (RLS policies cannot restrict columns),
-- so owners can never self-approve, and new shops always start as 'pending'.
create policy "owner update own shop" on public.businesses for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "team update shops" on public.businesses for update using (public.is_team());

-- Status rules: new shops must start 'pending'; status changes (approve /
-- reject / suspend) only by the DukaanPay team. Works for every code path.
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
create trigger trg_status_team_only
  before insert or update on public.businesses
  for each row execute function public.enforce_status_rules();
create policy "lead owner delete shop" on public.businesses for delete using (public.is_lead_owner());

-- ITEM CATEGORIES: business-scoped
create policy "crud own cats" on public.item_categories for all
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
         or public.is_team())
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- ITEMS: business-scoped
create policy "crud own items" on public.items for all
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
         or public.is_team())
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- BILLS: business-scoped
create policy "crud own bills" on public.bills for all
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
         or public.is_team())
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- NOTIFICATIONS: own only
create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update using (user_id = auth.uid());

-- SUPPORT: owner manages own tickets; team sees all
create policy "read own tickets" on public.support_tickets for select using (user_id = auth.uid() or public.is_team());
create policy "create own tickets" on public.support_tickets for insert with check (user_id = auth.uid());
create policy "update own tickets" on public.support_tickets for update using (user_id = auth.uid() or public.is_team());

create policy "read ticket msgs" on public.support_messages for select
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_team())));
create policy "send ticket msgs" on public.support_messages for insert
  with check (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_team())));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public) values ('assets', 'assets', true) on conflict do nothing;

create policy "public read assets" on storage.objects for select using (bucket_id = 'assets');
create policy "auth upload assets" on storage.objects for insert with check (bucket_id = 'assets' and auth.uid() is not null);
create policy "auth update assets" on storage.objects for update using (bucket_id = 'assets' and auth.uid() is not null);
create policy "auth delete assets" on storage.objects for delete using (bucket_id = 'assets' and auth.uid() is not null);

-- ============================================================
-- ADMIN BOOTSTRAP
-- After signing up, run this ONCE and replace the email below
-- with YOUR signup email to make yourself the Lead Owner:
--
-- update public.profiles set role = 'owner'
-- where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================
