import { SystemPage } from "@/features/telemetry/system-page";
import { getDeploymentPolicy } from "@/lib/security/deployment";
export const metadata = { title: "System Status" };
export default function Page() {
  const policy = getDeploymentPolicy();
  return (
    <SystemPage notificationTestsEnabled={policy.notificationTestsEnabled} />
  );
}
