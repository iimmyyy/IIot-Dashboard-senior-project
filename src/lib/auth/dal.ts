import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { backendAuthEnabled, readBackendSession } from "@/lib/api/backend-auth";

export const getCurrentSession = cache(() =>
  backendAuthEnabled() ? readBackendSession() : readSession(),
);

export const requireSession = cache(async () => {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
});
