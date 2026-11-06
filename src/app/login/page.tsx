import { Leaf } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentSession } from "@/lib/auth/dal";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentSession()) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-label="BioDry Research Monitor">
          <span className="brand-mark">
            <Leaf size={24} strokeWidth={1.8} />
          </span>
          <span>
            BioDry<small>RESEARCH MONITOR</small>
          </span>
        </div>
        <div className="login-heading">
          <h1 id="login-title">Sign in</h1>
          <p>Choose an account for this monitoring session.</p>
        </div>
        <LoginForm redirectTo={next} />
      </section>
    </main>
  );
}
