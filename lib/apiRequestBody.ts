const MAX_API_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

export type JsonRequestBodyResult =
  | { success: true; body: unknown }
  | { success: false; reason: "invalid_json" | "too_large" };

export async function readJsonRequestBody(
  request: Request,
): Promise<JsonRequestBodyResult> {
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_API_REQUEST_BODY_BYTES
  ) {
    return { success: false, reason: "too_large" };
  }

  if (!request.body) return { success: false, reason: "invalid_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_API_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { success: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { success: false, reason: "invalid_json" };
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { success: true, body: JSON.parse(body) as unknown };
  } catch {
    return { success: false, reason: "invalid_json" };
  }
}
