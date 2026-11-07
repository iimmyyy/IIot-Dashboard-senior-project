"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { authenticateDemoAccount } from "@/lib/auth/accounts";
import { createSession, deleteSession, readSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import {
  backendAuthEnabled,
  backendFetch,
  CSRF_COOKIE,
  DATABASE_SESSION_COOKIE,
} from "@/lib/api/backend-auth";
import { cookies } from "next/headers";
import { getDeploymentPolicy } from "@/lib/security/deployment";
import {
  clearRateLimit,
  clientAddress,
  takeRateLimit,
} from "@/lib/security/rate-limit";

export type LoginState = { error?: string } | undefined;

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(100),
  redirectTo: z.string().optional(),
});

function safeRedirect(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const policy = getDeploymentPolicy();
  if (!policy.demoAuthEnabled) return { error: policy.authMessage };

  const fields = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!fields.success) return { error: "Enter your username and password." };

  const requestHeaders = await headers();
  const limitKey = `login:${clientAddress(requestHeaders)}:${fields.data.username.toLowerCase()}`;
  const rateLimit = takeRateLimit(limitKey, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    console.warn("[security]", {
      action: "auth.rate_limited",
      username: fields.data.username.toLowerCase(),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return {
      error: `Too many sign-in attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const user = authenticateDemoAccount(
    fields.data.username,
    fields.data.password,
  );
  if (!user) return { error: "Username or password is incorrect." };

  try {
    await createSession(user);
  } catch {
    return {
      error:
        "Sign-in is unavailable because the session security settings are incomplete.",
    };
  }
  clearRateLimit(limitKey);
  recordAuditEvent(user, "auth.sign_in");
  redirect(safeRedirect(fields.data.redirectTo));
}

export async function logout() {
  if (backendAuthEnabled()) {
    const cookieStore = await cookies();
    const csrf = cookieStore.get(CSRF_COOKIE)?.value;
    if (csrf) {
      await backendFetch("/api/v1/auth/logout", {
        method: "POST",
        headers: {
          Origin: process.env.BIODRY_FRONTEND_ORIGIN ?? "http://localhost:3000",
          "X-CSRF-Token": csrf,
        },
      }).catch((error) => console.error("[backend-auth] logout failed", error));
    }
    cookieStore.delete(DATABASE_SESSION_COOKIE);
    cookieStore.delete(CSRF_COOKIE);
    redirect("/login");
  }
  const session = await readSession();
  if (session) recordAuditEvent(session.user, "auth.sign_out");
  await deleteSession();
  redirect("/login");
}
