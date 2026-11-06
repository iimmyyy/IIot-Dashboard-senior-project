"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticateDemoAccount } from "@/lib/auth/accounts";
import {
  createSession,
  deleteSession,
  readSession,
} from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";

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
  const fields = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!fields.success) return { error: "Enter your username and password." };

  const user = authenticateDemoAccount(
    fields.data.username,
    fields.data.password,
  );
  if (!user) return { error: "Username or password is incorrect." };

  await createSession(user);
  recordAuditEvent(user, "auth.sign_in");
  redirect(safeRedirect(fields.data.redirectTo));
}

export async function logout() {
  const session = await readSession();
  if (session) recordAuditEvent(session.user, "auth.sign_out");
  await deleteSession();
  redirect("/login");
}
