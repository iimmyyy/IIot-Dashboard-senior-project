"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { login } from "@/features/auth/actions";

const demoUsers = [
  { username: "professor", label: "Professor" },
  { username: "researcher", label: "Researcher" },
  { username: "staff", label: "Staff" },
];

export function LoginForm({
  redirectTo,
  enabled,
  databaseAuth,
  showLocalDemoCredentials,
  message,
}: {
  redirectTo?: string;
  enabled: boolean;
  databaseAuth: boolean;
  showLocalDemoCredentials: boolean;
  message: string;
}) {
  if (databaseAuth)
    return (
      <DatabaseLoginForm
        redirectTo={redirectTo}
        enabled={enabled}
        message={message}
      />
    );
  return (
    <DemoLoginForm
      redirectTo={redirectTo}
      enabled={enabled}
      showLocalDemoCredentials={showLocalDemoCredentials}
      message={message}
    />
  );
}

function DatabaseLoginForm({
  redirectTo,
  enabled,
  message,
}: {
  redirectTo?: string;
  enabled: boolean;
  message: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setError(body?.detail ?? "Sign-in could not be completed.");
        return;
      }
      const destination =
        redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("The authentication service is unavailable. Try again shortly.");
    } finally {
      setPending(false);
    }
  }

  if (!enabled)
    return (
      <div className="login-error" role="alert">
        {message}
      </div>
    );

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Username
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Password
        <span className="password-field">
          <LockKeyhole size={16} aria-hidden="true" />
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </span>
      </label>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <button className="login-submit" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
        {!pending && <ArrowRight size={17} aria-hidden="true" />}
      </button>
      <p className="demo-login-note">{message}</p>
    </form>
  );
}

function DemoLoginForm({
  redirectTo,
  enabled,
  showLocalDemoCredentials,
  message,
}: {
  redirectTo?: string;
  enabled: boolean;
  showLocalDemoCredentials: boolean;
  message: string;
}) {
  const [state, action, pending] = useActionState(login, undefined);
  const [username, setUsername] = useState(
    showLocalDemoCredentials ? "researcher" : "",
  );
  const [password, setPassword] = useState(
    showLocalDemoCredentials ? "demo2026" : "",
  );

  if (!enabled)
    return (
      <div className="login-error" role="alert">
        {message}
      </div>
    );

  return (
    <form action={action} className="login-form">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <div className="demo-account-picker" aria-label="Demonstration accounts">
        {demoUsers.map((user) => (
          <button
            key={user.username}
            type="button"
            className={username === user.username ? "selected" : ""}
            onClick={() => {
              setUsername(user.username);
              if (showLocalDemoCredentials) setPassword("demo2026");
            }}
          >
            {user.label}
          </button>
        ))}
      </div>
      <label>
        Username
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Password
        <span className="password-field">
          <LockKeyhole size={16} aria-hidden="true" />
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </span>
      </label>
      {state?.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="login-submit" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
        {!pending && <ArrowRight size={17} aria-hidden="true" />}
      </button>
      <p className="demo-login-note">
        {showLocalDemoCredentials ? "Local demo password: demo2026" : message}
      </p>
    </form>
  );
}
