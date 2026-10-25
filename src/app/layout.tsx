import type { Metadata } from "next";
import { Providers } from "@/hooks/use-monitor";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "BioDry · Research Monitor", template: "%s · BioDry" },
  description:
    "Clear, accessible biodrying temperature monitoring and research decision support.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
