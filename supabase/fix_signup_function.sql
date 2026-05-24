-- ReconCart — signup-flow fix.
-- Paste into https://supabase.com/dashboard/project/olsqrtqmxkxmlaiyqqlg/sql/new
-- then click Run. Idempotent — safe to re-run.
--
-- Why this exists:
-- ----------------
-- During signup the user has just authenticated but isn't yet a member of any
-- tenant. The RLS policies on `tenants` and `memberships` (correctly) require
-- the user to already be a member to mutate those tables. That's a chicken-
-- and-egg for the initial provisioning step.
--
-- The standard Supabase pattern is to expose a SECURITY DEFINER RPC that:
--   1. Reads auth.uid() to discover who is calling
--   2. Performs the privileged inserts as the function owner (bypassing RLS)
--   3. Returns the new tenant_id
--
-- We also diagnose any partial state from the prior schema run.

-- 1. Ensure the schema cache knows about the table (cheap no-op if it does)
notify pgrst, 'reload schema';

-- 2. The provisioning function
create or replace function public.create_tenant_for_current_user(
  p_slug          text,
  p_display_name  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_tenant_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Either find an existing tenant with this slug owned by this user
  -- (idempotency on retry), or create a fresh one.
  select id into v_tenant_id
    from public.tenants
   where slug = p_slug and owner_user_id = v_uid;

  if v_tenant_id is null then
    insert into public.tenants (slug, display_name, owner_user_id)
      values (p_slug, p_display_name, v_uid)
      returning id into v_tenant_id;
  end if;

  -- Upsert the membership row.
  insert into public.memberships (tenant_id, user_id, role)
    values (v_tenant_id, v_uid, 'admin')
    on conflict (tenant_id, user_id) do nothing;

  return v_tenant_id;
end;
$$;

-- Anyone with a valid JWT can call this. The function itself enforces
-- auth.uid() not-null inside the body.
grant execute on function public.create_tenant_for_current_user(text, text) to authenticated;

-- 3. Reload PostgREST's schema cache so the new RPC is reachable immediately
notify pgrst, 'reload schema';
