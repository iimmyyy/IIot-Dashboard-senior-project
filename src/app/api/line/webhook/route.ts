import {
  lineGroupEvents,
  verifyLineWebhookSignature,
} from "@/lib/notifications/line-webhook";

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
  if (!channelSecret)
    return Response.json(
      { error: "LINE webhook is not configured." },
      { status: 503 },
    );

  const signature = request.headers.get("x-line-signature");
  const rawBody = await request.text();
  if (
    !signature ||
    !verifyLineWebhookSignature(rawBody, signature, channelSecret)
  )
    return Response.json({ error: "Invalid signature." }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  for (const event of lineGroupEvents(payload)) {
    console.info("[line-webhook] group discovered", event);
  }

  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
