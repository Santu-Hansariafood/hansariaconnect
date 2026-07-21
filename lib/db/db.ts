import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const globalCache: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

global.mongooseCache = globalCache;

const cached: MongooseCache = globalCache;

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Optimized for 10k+ concurrent users
    const opts = {
      bufferCommands: false,
      maxPoolSize: 200, // Increase pool size for more concurrent connections
      minPoolSize: 50, // Keep more idle connections ready
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      connectTimeoutMS: 30000, // Timeout for initial connection
      maxIdleTimeMS: 60000, // Close idle connections after 1 minute
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => mongoose);
  }

  cached.conn = await cached.promise;

  return cached.conn;
}
