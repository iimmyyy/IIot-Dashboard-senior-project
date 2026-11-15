import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import {
  NotificationConfigurationError,
  sendEmailAlert,
  sendLineAlert,
} from "@/lib/notifications/providers";
import {
  demoExperiments,
  demoLatest,
} from "@/lib/mock/data";
import { notificationContextFromTelemetry } from "@/lib/notifications/notification-context";
import { alertSchema } from "@/types";

const bodySchema = z.object({
  channel: z.enum(["email", "line"]),
});

function sampleAlert(experimentId: string) {
  return alertSchema.parse({
    id: `TEST-${crypto.randomUUID()}`,
    experiment_id: experimentId,
    chamber_id: "L1",
    kind: "temperature_peak",
    title: "Temperature Peak Passed (Test)",
    description:
      "This is a delivery test from the BioDry monitoring dashboard. No laboratory action was triggered.",
    action:
      "Confirm that the message arrived and that the machine, evidence and recommended action are readable.",
    severity: "warning",
    detected_at: new Date().toISOString(),
    supporting_values: [
      { label: "Polynomial R²", value: "0.82" },
      { label: "Post-peak slope", value: "-1.4 °C/day" },
      { label: "Fitted drop", value: "1.1 °C" },
    ],
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
  });
}

export async function POST(request: Request) {
  if (process.env.NOTIFICATION_TEST_ENABLED !== "true")
    return Response.json({ error: "Notification testing is disabled." }, { status: 404 });

  const session = await readSession();
  if (!session)
    return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role === "staff")
    return Response.json({ error: "This role cannot send test notifications." }, { status: 403 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Choose email or line." }, { status: 400 });

  const sentAt = new Date().toISOString();
  const experiment =
    demoExperiments.find((candidate) => candidate.status === "running") ??
    demoExperiments[0];
  const frame = demoLatest("normal", "L1");
  const context = notificationContextFromTelemetry(
    frame,
    experiment?.start_date ?? null,
    sentAt,
  );
  const alert = sampleAlert(experiment?.id ?? "NOTIFICATION-TEST");
  const key = `${alert.id}:${parsed.data.channel}`;
  try {
    const receipt =
      parsed.data.channel === "email"
        ? await sendEmailAlert(alert, key, context)
        : await sendLineAlert(alert, key, context);
    return Response.json(
      { ok: true, receipt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const configuration = error instanceof NotificationConfigurationError;
    const message =
      error instanceof Error
        ? error.message
        : "The provider could not deliver the test notification.";
    console.error("[notification-test]", {
      channel: parsed.data.channel,
      actorId: session.user.id,
      error: message,
    });
    return Response.json(
      {
        error: message,
      },
      { status: configuration ? 503 : 502 },
    );
  }
}
