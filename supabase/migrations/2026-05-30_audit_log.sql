-- ReconCart 2026-05-30 — audit_log table.
--
-- Append-only record of every consequential server-action call:
-- track/condition/channel CRUD, sign-out, account delete, signing-secret
-- rotation. Foundation for SOC2-style compliance later — also gives the
-- support team a forensic trail when a user reports something missing.
--
-- Paste into Supabase SQL Editor:
-- https://supabase.com/dashboard/project/olsqrtqmxkxmlaiyqqlg/sql/new
-- Idempotent — safe to re-run.

create table if not exists public.audit_log (
  id            bigserial primary key,
  tenant_id     uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action        text not null,
  target_kind   text,
  target_id     text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_log_tenant_time
  on public.audit_log (tenant_id, created_at desc);
create index if not exists idx_audit_log_actor_time
  on public.audit_log (actor_user_id, created_at desc);

-- RLS — users see their tenant's audit entries (or their own if no tenant).
alter table public.audit_log enable row level security;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select
  using (
    tenant_id in (select public.user_tenant_ids())
    or actor_user_id = auth.uid()
  );

-- Inserts come from server actions running as the user. We do NOT allow
-- UPDATE or DELETE — audit logs are append-only. Service role can still
-- mutate via the admin client (e.g. for retention pruning) since RLS is
-- bypassed there.
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert
  with check (
    actor_user_id = auth.uid()
    and (
      tenant_id is null
      or tenant_id in (select public.user_tenant_ids())
    )
  );
