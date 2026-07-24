import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IApiKey extends Document {
  adminId: string;
  key: string;
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
    key: { type: String, required: true, unique: true },
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

// Generate a unique API key and store its hash
ApiKeySchema.methods.generateHash = async function (): Promise<string> {
  const rawKey = crypto.randomBytes(32).toString("hex");
  const salt = await crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(rawKey, salt, 100000, 64, "sha512")
    .toString("hex");

  // Store salt + hash (we need salt to verify later)
  this.key = `${salt}.${hash}`;
  return rawKey;
};

export default mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
