import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { emitDirectMessageReceived } from "@/lib/socketEmitter";
import { readJsonRequestBody } from "@/lib/apiRequestBody";
import { templateActionButtonsSchema } from "@/lib/templateActionButtons";

const eventSchema = z.object({
  fromUserId: z.string().regex(/^[a-f\d]{24}$/i),
  toUserId: z.string().regex(/^[a-f\d]{24}$/i),
  message: z.object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    type: z.string(),
    text: z.string(),
    mediaUrl: z.string(),
    fileName: z.string(),
    fileSize: z.string(),
    buttons: templateActionButtonsSchema,
    timestamp: z.coerce.date(),
    status: z.literal("sent"),
  }),
});

export async function POST(req: NextRequest) {
  const secret = process.env.BULK_MESSAGE_WORKER_SECRET;
  if (!secret) {
    console.error(
      "[bulk-message-worker] BULK_MESSAGE_WORKER_SECRET is not configured",
    );
    return NextResponse.json(
      { success: false, error: "Worker event endpoint is not configured" },
      { status: 503 },
    );
  }

  const authorization = req.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(suppliedSecret);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const bodyResult = await readJsonRequestBody(req);
  if (!bodyResult.success) {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = eventSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || "Invalid event" },
      { status: 400 },
    );
  }

  const { fromUserId, toUserId, message } = parsed.data;
  if (message.from !== fromUserId || message.to !== toUserId) {
    return NextResponse.json(
      { success: false, error: "Message participants do not match the event" },
      { status: 400 },
    );
  }

  await emitDirectMessageReceived(fromUserId, toUserId, message);
  return NextResponse.json({ success: true });
}
