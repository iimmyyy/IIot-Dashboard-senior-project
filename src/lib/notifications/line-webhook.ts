import { createHmac, timingSafeEqual } from "node:crypto";

const groupIdPattern = /^C[0-9a-f]{32}$/i;

export function verifyLineWebhookSignature(
  rawBody: string,
  suppliedSignature: string,
  channelSecret: string,
) {
  const expected = Buffer.from(
    createHmac("sha256", channelSecret).update(rawBody).digest("base64"),
  );
  const supplied = Buffer.from(suppliedSignature);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export type LineGroupEvent = {
  eventType: string;
  webhookEventId: string | null;
  groupId: string;
};

export function lineGroupEvents(payload: unknown): LineGroupEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const events = (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];

  return events.flatMap((event) => {
    if (!event || typeof event !== "object") return [];
    const candidate = event as {
      type?: unknown;
      webhookEventId?: unknown;
      source?: { type?: unknown; groupId?: unknown };
    };
    if (
      candidate.source?.type !== "group" ||
      typeof candidate.source.groupId !== "string" ||
      !groupIdPattern.test(candidate.source.groupId)
    )
      return [];
    return [
      {
        eventType:
          typeof candidate.type === "string" ? candidate.type : "unknown",
        webhookEventId:
          typeof candidate.webhookEventId === "string"
            ? candidate.webhookEventId
            : null,
        groupId: candidate.source.groupId,
      },
    ];
  });
}
