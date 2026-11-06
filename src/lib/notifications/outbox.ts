import type { NotificationJob, ResearchAlert } from "@/types";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function bangkokDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function createAlertNotificationJobs(
  alert: ResearchAlert,
  now = new Date().toISOString(),
): NotificationJob[] {
  return (["email", "line"] as const).map((channel) => ({
    id: `NTF-${crypto.randomUUID()}`,
    alert_id: alert.id,
    channel,
    status: "pending",
    idempotency_key: `${alert.id}:${channel}`,
    created_at: now,
    sent_at: null,
    attempts: 0,
    last_error: null,
  }));
}

export function formatLineAlert(
  alert: ResearchAlert,
  chamberId = alert.chamber_id ?? "Unassigned",
) {
  const evidence = alert.supporting_values
    .slice(0, 3)
    .map(({ label, value }) => `${label}: ${value}`)
    .join("\n");
  return [
    `⚠️ BioDry Alert — ${chamberId}`,
    alert.title,
    "",
    alert.description,
    evidence,
    "",
    `Action: ${alert.action}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLineFlexAlert(
  alert: ResearchAlert,
  chamberId = alert.chamber_id ?? "Unassigned",
) {
  const isCritical = alert.severity === "critical";
  const accent = isCritical ? "#B42318" : "#B54708";
  const actionBackground = isCritical ? "#FEE4E2" : "#FFF3E0";
  const evidence = alert.supporting_values.slice(0, 3);
  const evidenceContents = evidence.length
    ? evidence.map(({ label, value }) => ({
        type: "box" as const,
        layout: "horizontal" as const,
        spacing: "md" as const,
        contents: [
          {
            type: "text" as const,
            text: label,
            color: "#667085",
            size: "sm" as const,
            wrap: true,
            flex: 3,
          },
          {
            type: "text" as const,
            text: value,
            color: "#101828",
            size: "sm" as const,
            weight: "bold" as const,
            align: "end" as const,
            wrap: true,
            flex: 2,
          },
        ],
      }))
    : [
        {
          type: "text" as const,
          text: "No supporting values supplied",
          color: "#667085",
          size: "sm" as const,
          wrap: true,
        },
      ];

  return {
    type: "flex" as const,
    altText: `BioDry Alert: ${chamberId} — ${alert.title}`.slice(0, 1500),
    contents: {
      type: "bubble" as const,
      size: "kilo" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: accent,
        paddingAll: "20px",
        contents: [
          {
            type: "box" as const,
            layout: "horizontal" as const,
            alignItems: "center" as const,
            contents: [
              {
                type: "text" as const,
                text: "BIODRY MONITORING",
                color: "#FFFFFF",
                size: "xs" as const,
                weight: "bold" as const,
                flex: 1,
              },
              {
                type: "text" as const,
                text: alert.severity.toUpperCase(),
                color: "#FFFFFF",
                size: "xs" as const,
                weight: "bold" as const,
                align: "end" as const,
                flex: 0,
              },
            ],
          },
          {
            type: "text" as const,
            text: alert.title,
            color: "#FFFFFF",
            size: "xl" as const,
            weight: "bold" as const,
            wrap: true,
            margin: "md" as const,
          },
          {
            type: "text" as const,
            text: `${chamberId} • ${bangkokDateTime(alert.detected_at)} ICT`,
            color: "#FFFFFF",
            size: "xs" as const,
            wrap: true,
            margin: "sm" as const,
          },
        ],
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingAll: "20px",
        spacing: "md" as const,
        contents: [
          {
            type: "text" as const,
            text: alert.description,
            color: "#344054",
            size: "sm" as const,
            wrap: true,
          },
          {
            type: "separator" as const,
            color: "#EAECF0",
            margin: "sm" as const,
          },
          {
            type: "text" as const,
            text: "SUPPORTING VALUES",
            color: "#667085",
            size: "xs" as const,
            weight: "bold" as const,
            margin: "sm" as const,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: evidenceContents,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            backgroundColor: actionBackground,
            cornerRadius: "md" as const,
            paddingAll: "14px",
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: "RECOMMENDED ACTION",
                color: accent,
                size: "xs" as const,
                weight: "bold" as const,
              },
              {
                type: "text" as const,
                text: alert.action,
                color: "#344054",
                size: "sm" as const,
                wrap: true,
                margin: "sm" as const,
              },
            ],
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingAll: "14px",
        contents: [
          {
            type: "text" as const,
            text: `Alert ID: ${alert.id}`,
            color: "#98A2B3",
            size: "xxs" as const,
            align: "center" as const,
            wrap: true,
          },
        ],
      },
    },
  };
}

export function formatEmailAlert(
  alert: ResearchAlert,
  chamberId = alert.chamber_id ?? "Unassigned",
) {
  const subject = `[BioDry Alert] ${chamberId} — ${alert.title}`;
  const evidenceText = alert.supporting_values
    .map(({ label, value }) => `- ${label}: ${value}`)
    .join("\n");
  const text = [
    "BioDry Monitoring Alert",
    "",
    `Machine: ${chamberId}`,
    `Severity: ${alert.severity.toUpperCase()}`,
    `Detected: ${bangkokDateTime(alert.detected_at)} ICT`,
    `Alert: ${alert.title}`,
    "",
    alert.description,
    "",
    "Supporting values",
    evidenceText || "- No supporting values supplied",
    "",
    "Recommended action",
    alert.action,
    "",
    "Attachment: Draft batch summary PDF",
    "",
    `Alert ID: ${alert.id}`,
  ].join("\n");
  const evidenceHtml = alert.supporting_values.length
    ? `<ul>${alert.supporting_values
        .map(
          ({ label, value }) =>
            `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`,
        )
        .join("")}</ul>`
    : "<p>No supporting values supplied.</p>";
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7f5;color:#1c2b27;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border:1px solid #dfe7e3;border-radius:14px;overflow:hidden">
        <div style="background:#176b5b;color:#fff;padding:20px 24px">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">BioDry Monitoring Alert</div>
          <h1 style="font-size:22px;margin:8px 0 0">${escapeHtml(alert.title)}</h1>
        </div>
        <div style="padding:24px">
          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6d7d77">Machine</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(chamberId)}</td></tr>
            <tr><td style="padding:6px 0;color:#6d7d77">Severity</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(alert.severity.toUpperCase())}</td></tr>
            <tr><td style="padding:6px 0;color:#6d7d77">Detected</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(bangkokDateTime(alert.detected_at))} ICT</td></tr>
          </table>
          <p style="line-height:1.65;margin:22px 0">${escapeHtml(alert.description)}</p>
          <h2 style="font-size:16px;margin:22px 0 8px">Supporting values</h2>
          <div style="line-height:1.7">${evidenceHtml}</div>
          <div style="margin-top:22px;padding:16px;background:#edf6f2;border-radius:10px">
            <strong>Recommended action</strong>
            <p style="line-height:1.65;margin:6px 0 0">${escapeHtml(alert.action)}</p>
          </div>
          <p style="margin:18px 0 0;color:#526e63;font-size:13px"><strong>Attached:</strong> Draft batch summary PDF</p>
          <p style="margin:22px 0 0;color:#7b8b85;font-size:12px">Alert ID: ${escapeHtml(alert.id)}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
  return { subject, text, html };
}
