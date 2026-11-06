import { timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/lib/auth/types";

type DemoAccount = SessionUser & { password: string };

const demoAccounts: DemoAccount[] = [
  {
    id: "USR-PROF-001",
    username: "professor",
    displayName: "Professor Demo",
    role: "professor",
    password: "demo2026",
  },
  {
    id: "USR-RES-001",
    username: "researcher",
    displayName: "Researcher Demo",
    role: "researcher",
    password: "demo2026",
  },
  {
    id: "USR-STAFF-001",
    username: "staff",
    displayName: "Staff Demo",
    role: "staff",
    password: "demo2026",
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
): SessionUser | null {
  const account = demoAccounts.find(
    (candidate) => candidate.username === username.trim().toLowerCase(),
  );
  if (!account || !equal(password, account.password)) return null;

  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
  };
}
