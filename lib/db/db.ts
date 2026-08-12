import mongoose from "mongoose";
import Admin from "../../models/admin/Admin";

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

async function seedSuperAdmin() {
  try {
    const userId = process.env.INITIAL_SUPER_ADMIN_USER_ID;
    const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
    const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

    if (!userId || !email || !password) {
      console.log("Skipping super admin seeding: missing env vars");
      return;
    }

    const existingAdmin = await Admin.findOne({
      $or: [{ userId }, { email }],
    });

    if (!existingAdmin) {
      const superAdmin = new Admin({
        userId,
        email,
        password,
        isSuperAdmin: true,
      });
      await superAdmin.save();
      console.log("Initial super admin created successfully");
    } else {
      console.log("Super admin already exists");
    }
  } catch (error) {
    console.error("Error seeding super admin:", error);
  }
}

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const isProduction = process.env.NODE_ENV === "production";
    const defaultMaxPoolSize = isProduction ? 40 : 50;
    const defaultMinPoolSize = isProduction ? 5 : 0;
    const opts = {
      bufferCommands: false,
      maxPoolSize: process.env.MONGODB_POOL_SIZE
        ? Number(process.env.MONGODB_POOL_SIZE)
        : defaultMaxPoolSize,
      minPoolSize: process.env.MONGODB_MIN_POOL_SIZE
        ? Number(process.env.MONGODB_MIN_POOL_SIZE)
        : defaultMinPoolSize,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      connectTimeoutMS: 30000,
      maxIdleTimeMS: 60000,
      family: 4,
      autoCreate: false,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then(async (mongoose) => {
        await seedSuperAdmin();
        return mongoose;
      });
  }

  cached.conn = await cached.promise;

  return cached.conn;
}
