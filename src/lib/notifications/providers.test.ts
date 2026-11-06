import { describe, expect, it, vi } from "vitest";
import { demoAlerts } from "@/lib/mock/data";
import {
  emailConfigFromEnv,
  lineRetryKey,
  sendEmailAlert,
  sendLineAlert,
} from "./providers";

describe("notification providers", () => {
  it("requires server-side email configuration", () => {
    expect(() => emailConfigFromEnv({})).toThrow("ALERT_EMAIL_FROM");
  });

  it("reads a MailerSend display-name sender from server configuration", () => {
    expect(
      emailConfigFromEnv({
        EMAIL_PROVIDER: "mailersend",
        MAILERSEND_API_TOKEN: "secret",
        ALERT_EMAIL_FROM: "BioDry Alerts <alerts@test.example>",
        ALERT_EMAIL_TO: "lab@example.com",
      }),
    ).toEqual({
      apiToken: "secret",
      fromEmail: "alerts@test.example",
      fromName: "BioDry Alerts",
      to: "lab@example.com",
    });
  });

  it("sends a MailerSend report with a fixed server-side recipient", async () => {
    const headers = new Headers({ "x-message-id": "email-1" });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202, headers }));
    const receipt = await sendEmailAlert(
      demoAlerts()[0],
      "alert-1:email",
      {
        apiToken: "secret",
        fromEmail: "alerts@test.example",
        fromName: "BioDry Alerts",
        to: "lab@example.com",
      },
      fetcher,
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.mailersend.com/v1/email",
    );
    const payload = JSON.parse(init.body as string);
    expect(payload.to).toEqual([{ email: "lab@example.com" }]);
    expect(payload.from).toEqual({
      email: "alerts@test.example",
      name: "BioDry Alerts",
    });
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0]).toMatchObject({
      disposition: "attachment",
      filename: expect.stringMatching(/batch-summary\.pdf$/),
    });
    expect(
      Buffer.from(payload.attachments[0].content, "base64")
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(receipt.providerMessageId).toBe("email-1");
    expect(receipt.provider).toBe("mailersend");
  });

  it("uses a valid stable UUID retry key for LINE and treats 409 as accepted", async () => {
    const key = lineRetryKey("alert-1:line");
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(lineRetryKey("alert-1:line")).toBe(key);
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 409 }));
    const receipt = await sendLineAlert(
      demoAlerts()[0],
      "alert-1:line",
      { channelAccessToken: "secret", to: "U123" },
      fetcher,
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(init.body as string);
    expect(payload.messages[0]).toMatchObject({
      type: "flex",
      altText: expect.stringContaining("BioDry Alert"),
      contents: { type: "bubble" },
    });
    expect(receipt.duplicate).toBe(true);
  });
});
