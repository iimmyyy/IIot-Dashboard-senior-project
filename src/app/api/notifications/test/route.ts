import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { readSession } from "@/lib/auth/session";
import {
  NotificationConfigurationError,
  sendEmailAlert,
  sendLineAlert,
} from "@/lib/notifications/providers";
import { alertSchema } from "@/types";
import { getDeploymentPolicy } from "@/lib/security/deployment";
import {
  clientAddress,
  isSameOriginRequest,
  takeRateLimit,
} from "@/lib/security/rate-limit";

const bodySchema = z
  .object({
    channel: z.enum(["email", "line"]),
  })
  .strict();

const MAX_BODY_BYTES = 1_024;

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function sampleAlert() {
  return alertSchema.parse({
    id: `TEST-${crypto.randomUUID()}`,
    experiment_id: "NOTIFICATION-TEST",
    chamber_id: "L1",
    kind: "temperature_peak",
    title: "Temperature Peak Passed (Test)",
    description:
      "This is a delivery test from the BioDry monitoring dashboard. No laboratory action was triggered.",
    action:
      "Confirm that the message arrived and that the prototype selection, evidence and recommended action are readable.",
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
  const policy = getDeploymentPolicy();
  if (!policy.notificationTestsEnabled)
    return json({ error: "Notification testing is disabled." }, 404);

  if (!isSameOriginRequest(request))
    return json({ error: "Invalid request origin." }, 403);

  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Content-Type must be application/json." }, 415);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    return json({ error: "Request body is too large." }, 413);

  const session = await readSession();
  if (!session) return json({ error: "Authentication required." }, 401);
  if (session.user.role === "staff")
    return json({ error: "This role cannot send test notifications." }, 403);

  const rateLimit = takeRateLimit(
    `notification-test:${session.user.id}:${clientAddress(request.headers)}`,
    { limit: 3, windowMs: 10 * 60 * 1000 },
  );
  if (!rateLimit.allowed) {
    recordAuditEvent(session.user, "notification.test_rate_limited", {
      retryAfterSeconds: String(rateLimit.retryAfterSeconds),
    });
    return json(
      { error: "Too many notification tests. Try again later." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES)
    return json({ error: "Request body is too large." }, 413);
  const parsed = bodySchema.safeParse(
    (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed.success) return json({ error: "Choose email or line." }, 400);

  const alert = sampleAlert();
  const key = `${alert.id}:${parsed.data.channel}`;
  recordAuditEvent(session.user, "notification.test_requested", {
    channel: parsed.data.channel,
  });
  try {
    const receipt =
      parsed.data.channel === "email"
        ? await sendEmailAlert(alert, key)
        : await sendLineAlert(alert, key);
    recordAuditEvent(session.user, "notification.test_accepted", {
      channel: parsed.data.channel,
      provider: receipt.provider,
      duplicate: String(receipt.duplicate),
    });
    return json({ ok: true, receipt });
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
    recordAuditEvent(session.user, "notification.test_failed", {
      channel: parsed.data.channel,
      category: configuration ? "configuration" : "provider",
    });
    return json(
      {
        error: configuration
          ? "Notification provider configuration is incomplete."
          : "The provider could not deliver the test notification.",
      },
      configuration ? 503 : 502,
    );
  }
}
