"use client";

import { useActionState, useState } from "react";
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
