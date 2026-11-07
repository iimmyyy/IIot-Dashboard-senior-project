import { headers } from "next/headers";
import { z } from "zod";
import type { AuthSession, SessionUser } from "@/lib/auth/types";
export { DATABASE_SESSION_COOKIE, CSRF_COOKIE } from "@/lib/auth/constants";

const backendRole = z.enum(["professor", "researcher", "staff"]);
const backendUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  role: backendRole,
  is_system_admin: z.boolean(),
  memberships: z.array(
    z.object({
      project_id: z.string(),
      project_code: z.string(),
      project_name: z.string(),
      role: backendRole,
    }),
  ),
});

export function backendAuthEnabled() {
  return process.env.BIODRY_AUTH_MODE === "backend";
}

export function backendInternalUrl(path: string) {
  const base = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function backendFetch(path: string, init?: RequestInit) {
  const requestHeaders = await headers();
  return fetch(backendInternalUrl(path), {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/json",
      Cookie: requestHeaders.get("cookie") ?? "",
      ...init?.headers,
    },
  });
}

export function mapBackendUser(input: unknown): SessionUser {
  const user = backendUserSchema.parse(input);
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    isSystemAdmin: user.is_system_admin,
    memberships: user.memberships.map((membership) => ({
      projectId: membership.project_id,
      projectCode: membership.project_code,
      projectName: membership.project_name,
      role: membership.role,
    })),
  };
}

export async function readBackendSession(): Promise<AuthSession | null> {
  try {
    const response = await backendFetch("/api/v1/auth/me");
    if (response.status === 401) return null;
    if (!response.ok)
      throw new Error(`Authentication service returned ${response.status}.`);
    return {
      user: mapBackendUser(await response.json()),
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };
  } catch (error) {
    console.error("[backend-auth]", error);
    return null;
  }
}
