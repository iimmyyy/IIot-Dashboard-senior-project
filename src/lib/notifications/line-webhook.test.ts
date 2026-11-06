import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lineGroupEvents, verifyLineWebhookSignature } from "./line-webhook";

describe("LINE webhook", () => {
  it("verifies the signature against the untouched request body", () => {
    const body = '{"destination":"U123","events":[]}';
    const secret = "channel-secret";
    const signature = createHmac("sha256", secret)
      .update(body)
      .digest("base64");
    expect(verifyLineWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyLineWebhookSignature(`${body} `, signature, secret)).toBe(
      false,
    );
  });

  it("extracts only valid group sources without retaining message content", () => {
    const groupId = `C${"a".repeat(32)}`;
    expect(
      lineGroupEvents({
        events: [
          {
            type: "message",
            webhookEventId: "01TEST",
            source: { type: "group", groupId },
            message: { type: "text", text: "private group message" },
          },
          { type: "message", source: { type: "user", userId: "U123" } },
        ],
      }),
    ).toEqual([{ eventType: "message", webhookEventId: "01TEST", groupId }]);
  });
});
