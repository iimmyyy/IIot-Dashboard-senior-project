import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AuthSession, SessionUser } from "@/lib/auth/types";
import { validSessionSecret } from "@/lib/security/deployment";

export const SESSION_COOKIE = "biodry-session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function sessionSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env.AUTH_SESSION_SECRET?.trim();
  return validSessionSecret(secret) ? secret : null;
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function encodeSession(
  session: AuthSession,
  env: Record<string, string | undefined> = process.env,
) {
  const secret = sessionSecret(env);
  if (!secret)
    throw new Error(
      "AUTH_SESSION_SECRET must be a non-default value of at least 32 characters.",
    );
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function decodeSession(
  value?: string | null,
  env: Record<string, string | undefined> = process.env,
): AuthSession | null {
  if (!value) return null;
  const secret = sessionSecret(env);
  if (!secret) return null;
  const [payload, suppliedSignature, extra] = value.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expected = Buffer.from(signature(payload, secret));
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
  cookieStore.set(
    SESSION_COOKIE,
    encodeSession({ user, issuedAt, expiresAt }),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
      priority: "high",
    },
  );
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
