import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { hmacSha256Hex, randomBytesHex, decryptWebhookSecret } from "@/lib/crypto";
import WebhookConfig, {
  type WebhookEvent,
} from "@/models/admin/WebhookConfig";

type WebhookAddress = { address: string; family: number };

const isPublicIpv4 = (address: string) => {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [a, b, c] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const resolvePublicAddress = async (hostname: string): Promise<WebhookAddress> => {
  if (isIP(hostname)) {
    if (isIP(hostname) !== 4 || !isPublicIpv4(hostname)) {
      throw new Error("Webhook host must resolve to a public IPv4 address");
    }
    return { address: hostname, family: 4 };
  }

  const addresses = await lookup(hostname, { all: true, family: 4, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((entry) => entry.family !== 4 || !isPublicIpv4(entry.address))
  ) {
    throw new Error("Webhook host must resolve only to public IPv4 addresses");
  }
  return addresses[0];
};

const postSignedPayload = async (
  url: URL,
  address: WebhookAddress,
  event: WebhookEvent,
  body: string,
  signature: string,
) =>
  new Promise<void>((resolve, reject) => {
    const request = httpsRequest(
      {
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Hansaria-Event": event,
          "X-Hansaria-Signature": `sha256=${signature}`,
        },
        timeout: 5000,
        lookup: (_hostname, _options, callback) =>
          callback(null, address.address, address.family),
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          if (
            response.statusCode !== undefined &&
            response.statusCode >= 200 &&
            response.statusCode < 300
          ) {
            resolve();
          } else {
            reject(new Error(`Webhook endpoint returned HTTP ${response.statusCode ?? "unknown"}`));
          }
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("Webhook request timed out")));
    request.on("error", reject);
    request.end(body);
  });

export async function dispatchWebhookEvent(
  adminId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
) {
  try {
    const config = await WebhookConfig.findOne({
      adminId,
      enabled: true,
      events: event,
    })
      .select("url secret")
      .lean();
    if (!config) return;

    const url = new URL(config.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      throw new Error("Webhook URL must use HTTPS on port 443");
    }

    const address = await resolvePublicAddress(url.hostname);
    const deliveryId = randomBytesHex(16);
    const body = JSON.stringify({
      id: deliveryId,
      event,
      createdAt: new Date().toISOString(),
      data,
    });
    const signature = hmacSha256Hex(
      decryptWebhookSecret(config.secret),
      body,
    );
    await postSignedPayload(url, address, event, body, signature);
  } catch (error) {
    console.error("[webhook] Event delivery failed:", {
      adminId,
      event,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function dispatchApiKeyWebhookEvent(
  apiKeyId: string | undefined,
  event: WebhookEvent,
  data: Record<string, unknown>,
) {
  if (!apiKeyId) return;
  try {
    const ApiKey = (await import("@/models/apiKey/ApiKey")).default;
    const apiKey = await ApiKey.findById(apiKeyId).select("adminId").lean();
    if (!apiKey?.adminId) return;
    await dispatchWebhookEvent(apiKey.adminId, event, data);
  } catch (error) {
    console.error("[webhook] Could not resolve API key workspace:", {
      event,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
