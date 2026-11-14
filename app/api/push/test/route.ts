import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import {
  getNotificationPreferences,
  isWebPushEnabled,
  sendPushToUser,
} from "@/lib/webPush";
import { requireUser } from "@/lib/api/request";
import PushSubscription from "@/models/pushSubscription/PushSubscription";

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id || !Types.ObjectId.isValid(session.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isWebPushEnabled()) {
      return NextResponse.json(
        { error: "Background push is not configured on the server." },
        { status: 503 },
      );
    }

    const preferences = await getNotificationPreferences(session.id);
    if (!preferences.enabled || !preferences.messages) {
      return NextResponse.json(
        { error: "Enable message notifications in Settings before testing." },
        { status: 409 },
      );
    }

    await connectDB();
    const userId = new Types.ObjectId(session.id);
    const subscriptionCount = await PushSubscription.countDocuments({ userId });
    if (subscriptionCount === 0) {
      return NextResponse.json(
        { error: "This device is not subscribed. Re-enable browser notifications and try again." },
        { status: 409 },
      );
    }

    const acceptedDevices = await sendPushToUser(session.id, {
      title: "HansariaConnect test notification",
      body: "Your device can receive background push notifications.",
      tag: `push-test-${Date.now()}`,
      url: "/settings",
    });
    if (acceptedDevices === 0) {
      return NextResponse.json(
        {
          error:
            "The push service did not accept the notification. Check the server VAPID key pair and delivery logs.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      acceptedDevices,
    });
  } catch (error: unknown) {
    console.error("[api/push/test] Test notification failed:", error);
    return NextResponse.json(
      { error: "Could not send a test notification." },
      { status: 500 },
    );
  }
}
