// Active tenant resolution + listing for the multi-tenant switcher.
//
// Storage: HTTP-only cookie `active_tenant_id` (uuid). The cookie is just a
// hint — every query still goes through RLS via getServerSupabase(), so a
// tampered cookie cannot grant access to a tenant the user isn't a member of.
//
// Fallback: if no cookie, or the cookie points at a tenant the user is no
// longer a member of, we return the first tenant from the user's memberships
// (ordered by created_at). This preserves the pre-switcher single-tenant
// behavior for anyone who hasn't switched yet.

import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";

export type TenantRow = { id: string; display_name: string; slug: string };

const COOKIE_NAME = "active_tenant_id";

export async function listMyTenants(): Promise<TenantRow[]> {
  const supabase = await getServerSupabase();
  // RLS scopes this to the current user's memberships automatically.
  const { data } = await supabase
    .from("tenants")
    .select("id, display_name, slug, created_at")
    .order("created_at", { ascending: true });
  return (data ?? []).map(({ id, display_name, slug }) => ({
    id,
    display_name,
    slug,
  }));
}

export async function getActiveTenant(): Promise<TenantRow | null> {
  const tenants = await listMyTenants();
  if (tenants.length === 0) return null;

  const store = await cookies();
  const cookieId = store.get(COOKIE_NAME)?.value;
  if (cookieId) {
    const match = tenants.find((t) => t.id === cookieId);
    if (match) return match;
    // Cookie points at a tenant we can't see (revoked membership, stale cookie).
    // Fall through to the first-membership default.
  }
  return tenants[0];
}

export const ACTIVE_TENANT_COOKIE = COOKIE_NAME;
