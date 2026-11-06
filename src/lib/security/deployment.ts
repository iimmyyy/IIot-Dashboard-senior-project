export const deploymentProfiles = [
  "local-demo",
  "public-demo",
  "production",
] as const;

export type DeploymentProfile = (typeof deploymentProfiles)[number];
type RuntimeEnv = Record<string, string | undefined>;

const unsafeSecrets = new Set([
  "biodry-local-demo-session-secret-change-before-deployment",
  "replace-with-a-long-random-secret",
  "generate-a-unique-random-secret-of-at-least-32-characters",
  "demo2026",
]);

const unsafeDemoPasswords = new Set([
  "demo2026",
  "password",
  "password123",
  "changeme",
  "replace-me",
]);

export function validSessionSecret(value: string | undefined) {
  const secret = value?.trim();
  return !!secret && secret.length >= 32 && !unsafeSecrets.has(secret);
}

export function validPublicDemoPassword(value: string | undefined) {
  const password = value?.trim();
  return (
    !!password &&
    password.length >= 16 &&
    !unsafeDemoPasswords.has(password.toLowerCase())
  );
}

export type DeploymentPolicy = {
  profile: DeploymentProfile;
  dataMode: "demo" | "live";
  demoAuthEnabled: boolean;
  showLocalDemoCredentials: boolean;
  notificationTestsEnabled: boolean;
  authMessage: string;
  configurationErrors: string[];
};

export function getDeploymentPolicy(
  env: RuntimeEnv = process.env,
): DeploymentPolicy {
  const runtime = env.NODE_ENV ?? "development";
  const requested = env.BIODRY_DEPLOYMENT_PROFILE?.trim();
  const knownProfile = deploymentProfiles.find((value) => value === requested);
  const profile =
    knownProfile ?? (runtime === "production" ? "production" : "local-demo");
  const dataMode = env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
  const configurationErrors: string[] = [];

  if (requested && !knownProfile)
    configurationErrors.push("BIODRY_DEPLOYMENT_PROFILE is not recognized.");
  if (profile === "local-demo" && runtime === "production")
    configurationErrors.push(
      "The local-demo profile cannot run with NODE_ENV=production.",
    );
  if (profile === "public-demo" && dataMode !== "demo")
    configurationErrors.push(
      "The public-demo profile is restricted to simulated data.",
    );
  if (
    profile === "public-demo" &&
    !validPublicDemoPassword(env.DEMO_AUTH_PASSWORD)
  )
    configurationErrors.push(
      "Public demo access requires a non-default DEMO_AUTH_PASSWORD of at least 16 characters.",
    );
  if (
    (profile === "local-demo" || profile === "public-demo") &&
    !validSessionSecret(env.AUTH_SESSION_SECRET)
  )
    configurationErrors.push(
      "Demo sign-in requires a non-default AUTH_SESSION_SECRET of at least 32 characters.",
    );

  const demoAuthEnabled =
    profile !== "production" && configurationErrors.length === 0;
  const showLocalDemoCredentials =
    demoAuthEnabled && profile === "local-demo" && runtime !== "production";
  const notificationTestsEnabled =
    showLocalDemoCredentials && env.NOTIFICATION_TEST_ENABLED === "true";

  const authMessage = demoAuthEnabled
    ? profile === "public-demo"
      ? "Use the demonstration access password supplied by the project owner."
      : "Local demonstration accounts are enabled."
    : profile === "production" && configurationErrors.length === 0
      ? "Production authentication is not configured. Connect the approved identity service before enabling access."
      : "Sign-in is unavailable because the deployment security settings are incomplete.";

  return {
    profile,
    dataMode,
    demoAuthEnabled,
    showLocalDemoCredentials,
    notificationTestsEnabled,
    authMessage,
    configurationErrors,
  };
}

export function demoPasswordForEnvironment(
  env: RuntimeEnv = process.env,
): string | null {
  const policy = getDeploymentPolicy(env);
  if (!policy.demoAuthEnabled) return null;
  return policy.profile === "local-demo"
    ? env.DEMO_AUTH_PASSWORD?.trim() || "demo2026"
    : env.DEMO_AUTH_PASSWORD?.trim() || null;
}
