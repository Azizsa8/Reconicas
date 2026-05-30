-- ReconCart 2026-05-30 — api_keys table.
--
-- Stores SHA-256 hashes of issued API tokens. Plaintext keys are NEVER
-- persisted — the create modal shows them once, then they're gone.
-- The `prefix` column (first 12 chars of the key) is shown in the UI for
-- identification without compromising the secret.
--
-- Paste into Supabase SQL Editor:
-- https://supabase.com/dashboard/project/olsqrtqmxkxmlaiyqqlg/sql/new
-- Idempotent — safe to re-run.

create table if not exists public.api_keys (
  id            bigserial primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  prefix        text not null,
  hash          text not null unique,
  label         text,
  created_by    uuid references auth.users(id) on delete set null,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

-- Tenant listing uses (tenant_id, revoked_at IS NULL); cover both predicates.
create index if not exists idx_api_keys_tenant_active
  on public.api_keys (tenant_id)
  where revoked_at is null;

-- Hash lookup at request time is the hot path; needs an index for sub-ms
-- bearer auth. Hash is already UNIQUE so we use a partial index to keep
-- revoked keys out of the active path.
create index if not exists idx_api_keys_hash_active
  on public.api_keys (hash)
  where revoked_at is null;

-- RLS — tenant members manage their tenant's keys. The hash lookup at
-- request time happens via the service-role client (bypasses RLS).
alter table public.api_keys enable row level security;

drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select
  using (tenant_id in (select public.user_tenant_ids()));

drop policy if exists api_keys_insert on public.api_keys;
create policy api_keys_insert on public.api_keys for insert
  with check (
    tenant_id in (select public.user_tenant_ids())
    and created_by = auth.uid()
  );

-- UPDATE policy lets a member revoke (set revoked_at) but nothing else.
-- last_used_at is updated by the service-role caller at request time.
drop policy if exists api_keys_update_revoke on public.api_keys;
create policy api_keys_update_revoke on public.api_keys for update
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));

-- No DELETE policy — keys are soft-deleted by setting revoked_at.
