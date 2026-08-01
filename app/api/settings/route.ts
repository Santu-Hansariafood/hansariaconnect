import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Profile from "@/models/profile/Profile";

const parseSession = (req: NextRequest) => {
  const raw = req.cookies.get("user_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed as { id: string };
  } catch {
    return null;
  }
};

export async function GET(req: NextRequest) {
  try {
    const session = parseSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const profile = await Profile.findOne({ userId: session.id }).lean();
    if (!profile) {
      return NextResponse.json({
        theme: {
          wallpaper: "",
          wallpaperImage: "",
          primary: "#10b981",
          textSize: "text-base",
        },
        notifications: {
          messages: true,
          groups: true,
          enabled: true,
          ringtone: "chime",
        },
      });
    }

    return NextResponse.json({
      theme: (profile as any).theme || {
        wallpaper: "",
        wallpaperImage: "",
        primary: "#10b981",
        textSize: "text-base",
      },
      notifications: (profile as any).notifications || {
        messages: true,
        groups: true,
        enabled: true,
        ringtone: "chime",
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/settings error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = parseSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { theme, notifications } = body;

    const updateData: any = {};
    if (theme) {
      updateData.theme = {
        ...theme,
        wallpaper: theme.wallpaper || "",
        wallpaperImage: theme.wallpaperImage || "",
        primary: theme.primary || "#10b981",
        textSize: theme.textSize || "text-base",
      };
    }
    if (notifications) {
      updateData.notifications = {
        messages: notifications.messages,
        groups: notifications.groups,
        enabled: notifications.enabled,
        ringtone: notifications.ringtone || "chime",
      };
    }

    const updated = await Profile.findOneAndUpdate(
      { userId: session.id },
      { $set: updateData },
      { new: true, upsert: true },
    );

    return NextResponse.json({
      theme: (updated as any).theme,
      notifications: (updated as any).notifications,
    });
  } catch (error: unknown) {
    console.error("POST /api/settings error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
