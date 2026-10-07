import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/db";
import Profile from "@/models/profile/Profile";
import { apiError, parseJson, requireUser } from "@/lib/api/request";

type ThemeSettings = {
  wallpaper?: string;
  wallpaperImage?: string;
  primary?: string;
  secondary?: string;
  textSize?: string;
};

type NotificationSettings = {
  messages?: boolean;
  groups?: boolean;
  enabled?: boolean;
  ringtone?: string;
};

type StoredSettings = {
  theme?: ThemeSettings;
  notifications?: NotificationSettings;
};

const settingsSchema = z.object({
  theme: z
    .object({
      wallpaper: z.string().max(200).optional(),
      wallpaperImage: z.string().url().max(2000).optional().or(z.literal("")),
      primary: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      secondary: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      textSize: z.enum(["text-sm", "text-base", "text-lg"]).optional(),
    })
    .optional(),
  notifications: z
    .object({
      messages: z.boolean().optional(),
      groups: z.boolean().optional(),
      enabled: z.boolean().optional(),
      ringtone: z.string().max(200).optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser(req);
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
          ringtone: "whatsapp",
        },
      });
    }

    return NextResponse.json({
      theme: (profile as StoredSettings).theme || {
        wallpaper: "",
        wallpaperImage: "",
        primary: "#10b981",
        textSize: "text-base",
      },
      notifications: (profile as StoredSettings).notifications || {
        messages: true,
        groups: true,
        enabled: true,
        ringtone: "whatsapp",
      },
    });
  } catch (error: unknown) {
    return apiError(error, "GET /api/settings");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const parsedBody = await parseJson(req, settingsSchema);
    if (!parsedBody.success) return parsedBody.response;
    const { theme, notifications } = parsedBody.data;

    const updateData: StoredSettings = {};
    const currentProfile = await Profile.findOne({ userId: session.id }).lean<StoredSettings>();
    if (theme) {
      updateData.theme = {
        ...(currentProfile?.theme || {}),
        ...theme,
        wallpaper: theme.wallpaper || "",
        wallpaperImage: theme.wallpaperImage || "",
        primary: theme.primary || "#10b981",
        textSize: theme.textSize || "text-base",
      };
    }
    if (notifications) {
      updateData.notifications = {
        ...(currentProfile?.notifications || {}),
        ...(notifications.messages !== undefined && { messages: notifications.messages }),
        ...(notifications.groups !== undefined && { groups: notifications.groups }),
        ...(notifications.enabled !== undefined && { enabled: notifications.enabled }),
        ...(notifications.ringtone !== undefined && { ringtone: notifications.ringtone || "whatsapp" }),
      };
    }

    const updated = await Profile.findOneAndUpdate(
      { userId: session.id },
      { $set: updateData },
      { new: true, upsert: true },
    );

    return NextResponse.json({
      theme: (updated as unknown as StoredSettings).theme,
      notifications: (updated as unknown as StoredSettings).notifications,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/settings");
  }
}
