import webpush from "web-push";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db/db";
import Profile from "@/models/profile/Profile";
import PushSubscription from "@/models/pushSubscription/PushSubscription";

/**
 * Web Push delivery. Used by the server-side emitters to alert a recipient whose
 * app is not on screen — minimised, backgrounded (where mobile browsers freeze
 * the tab), or closed. The push service wakes the service worker over the
 * internet and the notification it raises plays the device alert sound, so
 * messages still arrive when the app is not running.
 */

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  image?: string;
};

type StoredSubscription = {
  _id: Types.ObjectId;
  endpoint: string;
  keys: { p256dh?: string; auth?: string };
};

export type NotificationPreferences = {
  enabled: boolean;
  messages: boolean;
  groups: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  messages: true,
  groups: true,
};

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "mailto:admin@hansariaconnect.app";

const PREFERENCES_CACHE_TTL_MS = 60_000;
const PREFERENCES_CACHE_LIMIT = 5_000;
const preferencesCache = new Map<
  string,
  { value: NotificationPreferences; expiresAt: number }
>();

let vapidConfigured = false;

export const isWebPushEnabled = (): boolean =>
  Boolean(publicKey && privateKey);

const configureVapid = (): boolean => {
  if (vapidConfigured) return true;
  if (!isWebPushEnabled()) return false;

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error(
      "[webPush] Invalid VAPID configuration:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
};

/**
 * The recipient's own notification switches are respected, so a push never
 * overrides a choice the user made in Settings.
 */
export const getNotificationPreferences = async (
  rawUserId: string,
): Promise<NotificationPreferences> => {
  const cached = preferencesCache.get(rawUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    await connectDB();
    const profile = await Profile.findOne({
      userId: new Types.ObjectId(rawUserId),
    })
      .select("notifications")
      .lean<{ notifications?: Partial<NotificationPreferences> } | null>();

    const value: NotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(profile?.notifications || {}),
    };

    if (preferencesCache.size >= PREFERENCES_CACHE_LIMIT) {
      preferencesCache.clear();
    }
    preferencesCache.set(rawUserId, {
      value,
      expiresAt: Date.now() + PREFERENCES_CACHE_TTL_MS,
    });

    return value;
  } catch (error) {
    console.error(
      "[webPush] Could not read notification preferences:",
      error instanceof Error ? error.message : error,
    );
    return DEFAULT_PREFERENCES;
  }
};

/**
 * Sends the payload to every device the user registered. Dead endpoints
 * (404/410 — the browser revoked the subscription) are pruned on the spot.
 */
export const sendPushToUser = async (
  rawUserId: string,
  payload: PushPayload,
): Promise<number> => {
  if (!Types.ObjectId.isValid(rawUserId) || !configureVapid()) return 0;

  let subscriptions: StoredSubscription[] = [];

  try {
    await connectDB();
    subscriptions = await PushSubscription.find({
      userId: new Types.ObjectId(rawUserId),
    })
      .select("endpoint keys")
      .lean<StoredSubscription[]>();
  } catch (error) {
    console.error(
      "[webPush] Could not load subscriptions:",
      error instanceof Error ? error.message : error,
    );
    return 0;
  }

  if (subscriptions.length === 0) return 0;

  const body = JSON.stringify({ ...payload, timestamp: Date.now() });
  const staleIds: Types.ObjectId[] = [];
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
        staleIds.push(subscription._id);
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          },
          body,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        delivered += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription._id);
          return;
        }
        console.error(
          "[webPush] Delivery failed:",
          statusCode || (error instanceof Error ? error.message : error),
        );
      }
    }),
  );

  if (staleIds.length > 0) {
    await PushSubscription.deleteMany({ _id: { $in: staleIds } }).catch(
      (error: unknown) =>
        console.error(
          "[webPush] Could not prune expired subscriptions:",
          error instanceof Error ? error.message : error,
        ),
    );
  }

  return delivered;
};

/**
 * Fire-and-forget helper: offloaded only when the app is not on screen — i.e.
 * the user cannot be alerted through the socket — and their preferences allow
 * this kind of chat. `isViewing` is the visibility-aware presence check, so a
 * minimised app is pushed to just like a closed one.
 */
export const pushIfNotViewing = async (
  rawUserId: string,
  kind: "direct" | "group",
  payload: PushPayload,
  isViewing: () => Promise<boolean>,
): Promise<void> => {
  if (!isWebPushEnabled()) return;

  try {
    const preferences = await getNotificationPreferences(rawUserId);
    if (!preferences.enabled) return;
    if (kind === "group" ? !preferences.groups : !preferences.messages) return;
    if (await isViewing()) return;

    await sendPushToUser(rawUserId, payload);
  } catch (error) {
    console.error(
      "[webPush] Offline push failed:",
      error instanceof Error ? error.message : error,
    );
  }
};
