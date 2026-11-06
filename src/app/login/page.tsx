import { Leaf } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentSession } from "@/lib/auth/dal";
import { getDeploymentPolicy } from "@/lib/security/deployment";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const policy = getDeploymentPolicy();

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
          <p>
            {policy.demoAuthEnabled
              ? "Choose an account for this demonstration session."
              : "Access is currently unavailable."}
          </p>
        </div>
        <LoginForm
          redirectTo={next}
          enabled={policy.demoAuthEnabled}
          showLocalDemoCredentials={policy.showLocalDemoCredentials}
          message={policy.authMessage}
        />
      </section>
    </main>
  );
}
