"use client";

import { useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  Mail,
  MessageCircle,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/shared";
import { useCurrentUser } from "@/features/auth/auth-context";

type Channel = "email" | "line";
type TestResult = {
  tone: "success" | "error";
  message: string;
} | null;

export function NotificationTestPanel() {
  const user = useCurrentUser();
  const [sending, setSending] = useState<Channel | null>(null);
  const [results, setResults] = useState<Record<Channel, TestResult>>({
    email: null,
    line: null,
  });
  const allowed = user.role === "researcher" || user.role === "professor";

  async function sendTest(channel: Channel) {
    setSending(channel);
    setResults((current) => ({ ...current, [channel]: null }));
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        receipt?: { duplicate?: boolean };
      } | null;
      if (!response.ok)
        throw new Error(
          body?.error ?? "The test notification could not be sent.",
        );
      setResults((current) => ({
        ...current,
        [channel]: {
          tone: "success",
          message: body?.receipt?.duplicate
            ? "Provider confirmed that this test was already accepted."
            : "Test notification accepted by the provider.",
        },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [channel]: {
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "The test notification could not be sent.",
        },
      }));
    } finally {
      setSending(null);
    }
  }

  const channels: Array<{
    id: Channel;
    title: string;
    description: string;
    icon: typeof Mail;
  }> = [
    {
      id: "email",
      title: "Email report",
      description:
        "Sends a formatted test report to the server-configured recipient.",
      icon: Mail,
    },
    {
      id: "line",
      title: "LINE alert",
      description:
        "Sends a formatted alert card to the configured user, group, or room.",
      icon: MessageCircle,
    },
  ];

  return (
    <section className="card notification-test-card">
      <div className="card-heading">
        <div>
          <h2>
            <Send size={18} />
            Notification Tests
          </h2>
          <p>Provider delivery test only. No laboratory action is triggered.</p>
        </div>
        <Badge tone="neutral">Authorized test</Badge>
      </div>
      <div className="notification-test-grid">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const result = results[channel.id];
          const pending = sending === channel.id;
          return (
            <div className="notification-test-item" key={channel.id}>
              <span className="notification-test-icon">
                <Icon size={19} />
              </span>
              <div className="notification-test-copy">
                <strong>{channel.title}</strong>
                <p>{channel.description}</p>
                {result && (
                  <p
                    className={`notification-test-result is-${result.tone}`}
                    role={result.tone === "error" ? "alert" : "status"}
                  >
                    {result.tone === "success" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <TriangleAlert size={14} />
                    )}
                    {result.message}
                  </p>
                )}
              </div>
              {allowed ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending !== null}
                  onClick={() => void sendTest(channel.id)}
                >
                  {pending ? (
                    <LoaderCircle
                      className="notification-test-spinner"
                      size={14}
                    />
                  ) : (
                    <Send size={14} />
                  )}
                  {pending ? "Sending…" : "Send test"}
                </Button>
              ) : (
                <Badge tone="neutral">View only</Badge>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
