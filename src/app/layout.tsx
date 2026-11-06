import type { Metadata } from "next";
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
        {children}
      </body>
    </html>
  );
}
