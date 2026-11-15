import { createHash } from "node:crypto";
import type { ResearchAlert } from "@/types";
import { formatEmailAlert, formatLineFlexAlert } from "./outbox";
import { batchReportFilename, createBatchSummaryPdf } from "./batch-report";

export type DeliveryReceipt = {
  channel: "email" | "line";
  provider: "resend" | "line-messaging-api";
  providerMessageId: string | null;
  duplicate: boolean;
};

export type EmailProviderConfig = {
  apiToken: string;
  fromEmail: string;
  fromName: string;
  to: string;
};

export type LineProviderConfig = {
  channelAccessToken: string;
  to: string;
};

export class NotificationConfigurationError extends Error {}

function required(value: string | undefined, name: string) {
  const clean = value?.trim();
  if (!clean)
    throw new NotificationConfigurationError(
      `${name} is required before notifications can be sent.`,
    );
  return clean;
}

export function emailConfigFromEnv(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): EmailProviderConfig {
  const provider = (env.EMAIL_PROVIDER ?? "resend").trim().toLowerCase();
  if (provider !== "resend")
    throw new NotificationConfigurationError(
      `Unsupported EMAIL_PROVIDER: ${provider}.`,
    );
  const from = required(env.ALERT_EMAIL_FROM, "ALERT_EMAIL_FROM");
  const mailbox = from.match(/^\s*(?:(.*?)\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
  const bareEmail = from.match(/^([^<>\s]+@[^<>\s]+)$/);
  if (!mailbox && !bareEmail)
    throw new NotificationConfigurationError(
      "ALERT_EMAIL_FROM must be an email address or Name <email>.",
    );
  return {
    apiToken: required(env.RESEND_API_KEY, "RESEND_API_KEY"),
    fromEmail: mailbox?.[2] ?? bareEmail?.[1] ?? "",
    fromName: mailbox?.[1]?.trim() || "BioDry Alerts",
    to: required(env.ALERT_EMAIL_TO, "ALERT_EMAIL_TO"),
  };
}

export function lineConfigFromEnv(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): LineProviderConfig {
  return {
    channelAccessToken: required(
      env.LINE_CHANNEL_ACCESS_TOKEN,
      "LINE_CHANNEL_ACCESS_TOKEN",
    ),
    to: required(env.LINE_TO, "LINE_TO"),
  };
}

function providerError(provider: string, status: number, body: string) {
  const detail = body.replace(/\s+/g, " ").slice(0, 300);
  return new Error(
    `${provider} rejected the notification (${status})${detail ? `: ${detail}` : "."}`,
  );
}

export function lineRetryKey(idempotencyKey: string) {
  const hash = createHash("sha256").update(idempotencyKey).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function sendEmailAlert(
  alert: ResearchAlert,
  idempotencyKey: string,
  config = emailConfigFromEnv(),
  fetcher: typeof fetch = fetch,
): Promise<DeliveryReceipt> {
  const report = formatEmailAlert(alert);
  const batchReport = await createBatchSummaryPdf(alert);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [config.to],
      subject: report.subject,
      text: report.text,
      html: report.html,
      attachments: [
        {
          filename: batchReportFilename(alert),
          content: Buffer.from(batchReport).toString("base64"),
          content_type: "application/pdf",
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  if (!response.ok) throw providerError("Resend", response.status, body);
  const parsed = (() => {
    try {
      return JSON.parse(body) as { id?: unknown };
    } catch {
      return null;
    }
  })();
  const id = typeof parsed?.id === "string" ? parsed.id : null;
  if (!id) throw new Error("Resend accepted the request without an email ID.");
  return {
    channel: "email",
    provider: "resend",
    providerMessageId: id,
    duplicate: false,
  };
}

export async function sendLineAlert(
  alert: ResearchAlert,
  idempotencyKey: string,
  config = lineConfigFromEnv(),
  fetcher: typeof fetch = fetch,
): Promise<DeliveryReceipt> {
  const response = await fetcher("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.channelAccessToken}`,
      "Content-Type": "application/json",
      "X-Line-Retry-Key": lineRetryKey(idempotencyKey),
    },
    body: JSON.stringify({
      to: config.to,
      messages: [formatLineFlexAlert(alert)],
      notificationDisabled: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  if (!response.ok && response.status !== 409)
    throw providerError("LINE", response.status, body);
  return {
    channel: "line",
    provider: "line-messaging-api",
    providerMessageId: response.headers.get("x-line-request-id"),
    duplicate: response.status === 409,
  };
}
