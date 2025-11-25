import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache;
if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}
cached = global.mongoose as MongooseCache;

export async function connectDB() {
  const MONGODB_URL = process.env.MONGODB_URI as string;
  if (!MONGODB_URL) {
    throw new Error("Missing MONGODB_URI in environment variables");
  }
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URL, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 30000,
      })
      .then((mongoose) => mongoose);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
