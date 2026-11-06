import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AuthSession, SessionUser } from "@/lib/auth/types";

export const SESSION_COOKIE = "biodry-session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ??
    "biodry-local-demo-session-secret-change-before-deployment"
  );
}

function signature(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function encodeSession(session: AuthSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function decodeSession(value?: string | null): AuthSession | null {
  if (!value) return null;
  const [payload, suppliedSignature, extra] = value.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AuthSession;
    if (
      !session.user?.id ||
      !session.user?.username ||
      !session.user?.displayName ||
      !["professor", "researcher", "staff"].includes(session.user.role) ||
      !Number.isFinite(session.issuedAt) ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    )
      return null;
    return session;
  } catch {
    return null;
  }
}

export async function readSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function createSession(user: SessionUser) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_DURATION_SECONDS * 1000;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession({ user, issuedAt, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
