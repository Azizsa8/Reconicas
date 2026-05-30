"use server";

// Server action that flips the active tenant cookie. We re-check membership
// via RLS (listMyTenants only returns tenants the user can see), so a client
// can't smuggle in an arbitrary uuid.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { listMyTenants, ACTIVE_TENANT_COOKIE } from "@/lib/tenant";

export async function setActiveTenantAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId || typeof tenantId !== "string") {
    return { ok: false, error: "Missing tenant id." };
  }
  const tenants = await listMyTenants();
  if (!tenants.some((t) => t.id === tenantId)) {
    return { ok: false, error: "Tenant not accessible." };
  }
  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  // Refresh every page under /app — sidebar counts, dashboard, lists.
  revalidatePath("/app", "layout");
  return { ok: true };
}
