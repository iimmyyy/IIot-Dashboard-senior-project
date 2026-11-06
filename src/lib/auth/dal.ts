import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";

export const getCurrentSession = cache(readSession);

export const requireSession = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
});
