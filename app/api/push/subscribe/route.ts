import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db/db";
import PushSubscription from "@/models/pushSubscription/PushSubscription";
import { apiError, parseJson, requireUser } from "@/lib/api/request";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

/** Registers (or refreshes) the browser/device endpoint for Web Push. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id || !Types.ObjectId.isValid(session.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJson(req, subscribeSchema);
    if (!parsedBody.success) return parsedBody.response;

    await connectDB();

    const { endpoint, keys } = parsedBody.data;

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId: new Types.ObjectId(session.id),
          keys,
          userAgent: (req.headers.get("user-agent") || "").slice(0, 400),
        },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "POST /api/push/subscribe");
  }
}

/** Called when the user turns notifications off, or the device signs out. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id || !Types.ObjectId.isValid(session.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJson(req, unsubscribeSchema);
    if (!parsedBody.success) return parsedBody.response;

    await connectDB();

    await PushSubscription.deleteOne({
      userId: new Types.ObjectId(session.id),
      endpoint: parsedBody.data.endpoint,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "DELETE /api/push/subscribe");
  }
}
