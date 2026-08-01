const textEncoder = new TextEncoder();

const bufferToHex = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const nodeDigest = async (alg: string, data: string) => {
  const node = await import("crypto");
  return node.createHash(alg).update(data).digest("hex");
};

export async function digestHex(algorithm: "SHA-1" | "SHA-256", data: string) {
  const subtle = (globalThis as any).crypto?.subtle;
  const algo = algorithm;
  if (subtle && typeof subtle.digest === "function") {
    const hash = await subtle.digest(algo, textEncoder.encode(data));
    return bufferToHex(hash);
  }
  // fallback to Node
  const map: Record<string, string> = { "SHA-1": "sha1", "SHA-256": "sha256" };
  return nodeDigest(map[algorithm], data);
}

export async function pbkdf2Hex(password: string, salt: string, iterations: number, keyLen: number, digest: string) {
  const subtle = (globalThis as any).crypto?.subtle;
  const enc = textEncoder;
  if (subtle && typeof subtle.importKey === "function" && typeof subtle.deriveBits === "function") {
    const keyMaterial = await subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const derivedBits = await subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations,
        hash: digest,
      },
      keyMaterial,
      keyLen * 8,
    );
    return bufferToHex(derivedBits);
  }
  const node = await import("crypto");
  return node.pbkdf2Sync(password, salt, iterations, keyLen, digest).toString("hex");
}

export async function hmacSha256Hex(key: string, message: string) {
  const subtle = (globalThis as any).crypto?.subtle;
  if (subtle && typeof subtle.importKey === "function") {
    const enc = textEncoder;
    const keyData = enc.encode(key);
    const cryptoKey = await subtle.importKey("raw", keyData, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
    const sig = await subtle.sign("HMAC", cryptoKey, enc.encode(message));
    return bufferToHex(sig);
  }
  const node = await import("crypto");
  return node.createHmac("sha256", key).update(message).digest("hex");
}

export async function randomBytesHex(size: number) {
  const web = (globalThis as any).crypto;
  if (web && typeof web.getRandomValues === "function") {
    const arr = new Uint8Array(size);
    web.getRandomValues(arr);
    return bufferToHex(arr);
  }
  const node = await import("crypto");
  return node.randomBytes(size).toString("hex");
}

export default {
  digestHex,
  pbkdf2Hex,
  hmacSha256Hex,
  randomBytesHex,
};