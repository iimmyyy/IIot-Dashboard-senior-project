import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/features/auth/auth-context";
import { Providers } from "@/hooks/use-monitor";
import { requireSession } from "@/lib/auth/dal";

export default async function MonitorLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return (
    <AuthProvider user={session.user}>
      <Providers>
        <AppShell>{children}</AppShell>
      </Providers>
    </AuthProvider>
  );
}
