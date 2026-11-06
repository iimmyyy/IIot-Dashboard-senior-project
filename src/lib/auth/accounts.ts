import { timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/lib/auth/types";
import { demoPasswordForEnvironment } from "@/lib/security/deployment";

type DemoAccount = SessionUser;

const demoAccounts: DemoAccount[] = [
  {
    id: "USR-PROF-001",
    username: "professor",
    displayName: "Professor Demo",
    role: "professor",
  },
  {
    id: "USR-RES-001",
    username: "researcher",
    displayName: "Researcher Demo",
    role: "researcher",
  },
  {
    id: "USR-STAFF-001",
    username: "staff",
    displayName: "Staff Demo",
    role: "staff",
  },
];

function equal(value: string, expected: string) {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function authenticateDemoAccount(
  username: string,
  password: string,
  env: Record<string, string | undefined> = process.env,
): SessionUser | null {
  const expectedPassword = demoPasswordForEnvironment(env);
  if (!expectedPassword) return null;
  const account = demoAccounts.find(
    (candidate) => candidate.username === username.trim().toLowerCase(),
  );
  if (!account || !equal(password, expectedPassword)) return null;

  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
  };
}
