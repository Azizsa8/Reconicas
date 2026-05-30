-- ReconCart — initial schema
-- Paste this into the Supabase SQL Editor:
--   https://app.supabase.com/project/olsqrtqmxkxmlaiyqqlg/sql/new
-- Then click "Run". Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Tenants (workspaces)
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  display_name    text not null,
  owner_user_id   uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index if not exists idx_tenants_owner on public.tenants(owner_user_id);

-- ---------------------------------------------------------------------------
-- Memberships (many-to-many user <-> tenant with role)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.tenant_role as enum ('admin','member','viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.memberships (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.tenant_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists idx_memberships_user on public.memberships(user_id);

-- ---------------------------------------------------------------------------
-- Tracks (renamed from "watches" in the original engine; same concept)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.track_cadence as enum ('hourly','daily','weekly','ondemand');
exception when duplicate_object then null; end $$;

create table if not exists public.tracks (
  id            bigserial primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  url           text not null,
  intent        text,
  cadence       public.track_cadence not null default 'hourly',
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  last_run_at   timestamptz
);
create index if not exists idx_tracks_tenant on public.tracks(tenant_id);

-- ---------------------------------------------------------------------------
-- Scrapes
-- ---------------------------------------------------------------------------
create table if not exists public.scrapes (
  id           bigserial primary key,
  track_id     bigint not null references public.tracks(id) on delete cascade,
  scraped_at   timestamptz not null default now(),
  ok           boolean not null,
  tier         smallint,
  payload      jsonb not null
);
create index if not exists idx_scrapes_track_time on public.scrapes(track_id, scraped_at desc);

-- ---------------------------------------------------------------------------
-- Alert conditions
-- ---------------------------------------------------------------------------
create table if not exists public.conditions (
  id           bigserial primary key,
  track_id     bigint not null references public.tracks(id) on delete cascade,
  expression   text not null,
  label        text,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_conditions_track on public.conditions(track_id);

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
create table if not exists public.alerts (
  id             bigserial primary key,
  condition_id   bigint not null references public.conditions(id) on delete cascade,
  scrape_id      bigint not null references public.scrapes(id) on delete cascade,
  fired_at       timestamptz not null default now(),
  explanation    text not null,
  acknowledged   boolean not null default false
);
create index if not exists idx_alerts_fired on public.alerts(fired_at desc);

-- ---------------------------------------------------------------------------
-- Delivery channels
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.channel_kind as enum ('webhook','email','console');
exception when duplicate_object then null; end $$;

create table if not exists public.delivery_channels (
  id           bigserial primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  kind         public.channel_kind not null,
  target       text not null,
  config       jsonb,
  label        text,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_channels_tenant on public.delivery_channels(tenant_id);

create table if not exists public.deliveries (
  id            bigserial primary key,
  alert_id      bigint not null references public.alerts(id) on delete cascade,
  channel_id    bigint not null references public.delivery_channels(id) on delete cascade,
  attempted_at  timestamptz not null default now(),
  ok            boolean not null,
  status_code   integer,
  detail        text
);
create index if not exists idx_deliveries_alert on public.deliveries(alert_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security — everything tenant-scoped via memberships
-- ---------------------------------------------------------------------------
alter table public.tenants            enable row level security;
alter table public.memberships        enable row level security;
alter table public.tracks             enable row level security;
alter table public.scrapes            enable row level security;
alter table public.conditions         enable row level security;
alter table public.alerts             enable row level security;
alter table public.delivery_channels  enable row level security;
alter table public.deliveries         enable row level security;

-- helper: tenants the current user is a member of
create or replace function public.user_tenant_ids() returns setof uuid
language sql stable security definer as $$
  select tenant_id from public.memberships where user_id = auth.uid()
$$;

-- Tenants
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select
  using (id in (select public.user_tenant_ids()));

drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert on public.tenants for insert
  with check (owner_user_id = auth.uid());

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update
  using (id in (select public.user_tenant_ids()))
  with check (id in (select public.user_tenant_ids()));

-- Memberships
drop policy if exists memberships_self on public.memberships;
create policy memberships_self on public.memberships for select
  using (user_id = auth.uid() or tenant_id in (select public.user_tenant_ids()));

drop policy if exists memberships_insert_owner on public.memberships;
create policy memberships_insert_owner on public.memberships for insert
  with check (
    -- A user can insert a membership row for themselves into a tenant they own,
    -- which is what signupAction does right after creating the tenant.
    user_id = auth.uid()
    and tenant_id in (
      select id from public.tenants where owner_user_id = auth.uid()
    )
  );

-- Tenant-scoped tables (template policy applied with macros)
-- TRACKS
drop policy if exists tracks_rw on public.tracks;
create policy tracks_rw on public.tracks for all
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

-- SCRAPES — scoped via track
drop policy if exists scrapes_rw on public.scrapes;
create policy scrapes_rw on public.scrapes for all
  using (track_id in (select id from public.tracks where tenant_id in (select public.user_tenant_ids())))
  with check (track_id in (select id from public.tracks where tenant_id in (select public.user_tenant_ids())));

-- CONDITIONS — scoped via track
drop policy if exists conditions_rw on public.conditions;
create policy conditions_rw on public.conditions for all
  using (track_id in (select id from public.tracks where tenant_id in (select public.user_tenant_ids())))
  with check (track_id in (select id from public.tracks where tenant_id in (select public.user_tenant_ids())));

-- ALERTS — scoped via condition -> track
drop policy if exists alerts_rw on public.alerts;
create policy alerts_rw on public.alerts for all
  using (condition_id in (
    select c.id from public.conditions c
    join public.tracks t on t.id = c.track_id
    where t.tenant_id in (select public.user_tenant_ids())
  ))
  with check (condition_id in (
    select c.id from public.conditions c
    join public.tracks t on t.id = c.track_id
    where t.tenant_id in (select public.user_tenant_ids())
  ));

-- CHANNELS
drop policy if exists channels_rw on public.delivery_channels;
create policy channels_rw on public.delivery_channels for all
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

-- DELIVERIES — scoped via channel
drop policy if exists deliveries_rw on public.deliveries;
create policy deliveries_rw on public.deliveries for all
  using (channel_id in (
    select id from public.delivery_channels
    where tenant_id in (select public.user_tenant_ids())
  ))
  with check (channel_id in (
    select id from public.delivery_channels
    where tenant_id in (select public.user_tenant_ids())
  ));
