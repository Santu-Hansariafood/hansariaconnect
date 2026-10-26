import mongoose, { Schema, Document } from "mongoose";
import { randomBytesHex, pbkdf2Hex, digestHex } from "@/lib/crypto";

export interface IApiKey extends Document {
  adminId: string;
  keySlot?: number;
  senderUserId?: string;
  isPrimary: boolean;
  key: string;
  /** Indexable digest of the raw key, so validation never scans every key. */
  keyLookup?: string;
  name: string;
  permissions: {
    sendMessage: boolean;
    readMessages: boolean;
    manageContacts: boolean;
  };
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  generateHash(): Promise<string>;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    adminId: { type: String, required: true },
    keySlot: { type: Number },
    senderUserId: { type: String },
    isPrimary: { type: Boolean, default: false },
    key: { type: String, required: true, unique: true },
    keyLookup: { type: String },
    name: { type: String, required: true },
    permissions: {
      sendMessage: { type: Boolean, default: true },
      readMessages: { type: Boolean, default: true },
      manageContacts: { type: Boolean, default: false }
    },
    lastUsed: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ApiKeySchema.index(
  { adminId: 1, keySlot: 1 },
  {
    unique: true,
    partialFilterExpression: { keySlot: { $type: "number" } },
  },
);
ApiKeySchema.index(
  { adminId: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  },
);
ApiKeySchema.index(
  { keyLookup: 1 },
  {
    unique: true,
    partialFilterExpression: { keyLookup: { $type: "string" } },
  },
);

// Generate a unique API key and store its hash
ApiKeySchema.methods.generateHash = async function (): Promise<string> {
  const rawKey = await randomBytesHex(32);
  const salt = await randomBytesHex(16);
  const hash = await pbkdf2Hex(rawKey, salt, 100000, 64, "SHA-512");

  // Store salt + hash (we need salt to verify later)
  this.key = `${salt}.${hash}`;
  // A digest of a 256-bit random key cannot be reversed, but it can be indexed,
  // which turns API-key validation into a single-document lookup.
  this.keyLookup = digestHex("SHA-256", rawKey);
  return rawKey;
};

export default mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
