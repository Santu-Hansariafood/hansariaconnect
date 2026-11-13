import mongoose, { type Connection } from "mongoose";
import Admin from "../../models/admin/Admin";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type StateConnectionCache = Map<string, {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}>;

declare global {
  var mongooseCache: MongooseCache | undefined;
  var stateConnectionCache: StateConnectionCache | undefined;
  var communicationsConnectionCache: { conn: Connection | null; promise: Promise<Connection> | null } | undefined;
}

const globalCache: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

global.mongooseCache = globalCache;
const stateCache: StateConnectionCache = global.stateConnectionCache || new Map();
global.stateConnectionCache = stateCache;
const communicationsCache = global.communicationsConnectionCache || {
  conn: null,
  promise: null,
};
global.communicationsConnectionCache = communicationsCache;

const cached: MongooseCache = globalCache;

async function seedInitialAdmin(
  userId: string | undefined,
  email: string | undefined,
  password: string | undefined,
  isSuperAdmin: boolean,
) {
  if (!userId || !email || !password) return;

  const normalizedUserId = userId.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const [adminByUserId, adminByEmail] = await Promise.all([
    Admin.findOne({ userId: normalizedUserId }),
    Admin.findOne({ email: normalizedEmail }),
  ]);

  if (
    adminByUserId &&
    adminByEmail &&
    String(adminByUserId._id) !== String(adminByEmail._id)
  ) {
    console.error(
      "Initial admin configuration matches different accounts; skipping bootstrap",
    );
    return;
  }

  const existingAdmin = adminByUserId || adminByEmail;
  if (existingAdmin) {
    if (isSuperAdmin && !existingAdmin.isSuperAdmin) {
      existingAdmin.isSuperAdmin = true;
      await existingAdmin.save();
      console.log("Configured super admin role ensured");
    }
    return;
  }

  const admin = new Admin({
    userId: normalizedUserId,
    email: normalizedEmail,
    password,
    isSuperAdmin,
  });
  await admin.save();
  console.log(`Initial ${isSuperAdmin ? "super admin" : "admin"} created successfully`);
}

async function seedConfiguredAdmins() {
  await seedInitialAdmin(
    process.env.INITIAL_SUPER_ADMIN_USER_ID,
    process.env.INITIAL_SUPER_ADMIN_EMAIL,
    process.env.INITIAL_SUPER_ADMIN_PASSWORD,
    true,
  );
  await seedInitialAdmin(
    process.env.INITIAL_ADMIN_USER_ID,
    process.env.INITIAL_ADMIN_EMAIL,
    process.env.INITIAL_ADMIN_PASSWORD,
    false,
  );
}

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_CONTROL_URI || process.env.MONGODB_URI;

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
        await seedConfiguredAdmins();
        return mongoose;
      })
      .catch((error: unknown) => {
        cached.conn = null;
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;

  return cached.conn;
}

const normalizeStateCode = (stateCode: string): string =>
  stateCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

const stateConnectionOptions = {
  bufferCommands: false,
  maxPoolSize: Number(process.env.MONGODB_STATE_POOL_SIZE || 40),
  minPoolSize: Number(process.env.MONGODB_STATE_MIN_POOL_SIZE || 5),
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  connectTimeoutMS: 30000,
  maxIdleTimeMS: 60000,
  family: 4,
  autoCreate: false,
};

/** Connect to a state database without exposing its URI to request handlers. */
export async function connectStateDB(stateCode: string): Promise<Connection> {
  const normalizedState = normalizeStateCode(stateCode);
  if (!normalizedState) throw new Error("Missing state code");

  const uri = process.env[`MONGODB_STATE_${normalizedState}_URI`];
  if (!uri) {
    throw new Error(`Missing database configuration for state ${normalizedState}`);
  }

  let cachedState = stateCache.get(normalizedState);
  if (!cachedState) {
    cachedState = { conn: null, promise: null };
    stateCache.set(normalizedState, cachedState);
  }

  if (cachedState.conn) return cachedState.conn;
  if (!cachedState.promise) {
    cachedState.promise = mongoose
      .createConnection(uri, stateConnectionOptions)
      .asPromise()
      .then((connection) => {
        cachedState!.conn = connection;
        return connection;
      });
  }

  return cachedState.promise;
}

export async function connectCommunicationsDB(): Promise<Connection> {
  const uri = process.env.MONGODB_COMMUNICATIONS_URI;
  if (!uri) throw new Error("Missing MONGODB_COMMUNICATIONS_URI");
  if (communicationsCache.conn) return communicationsCache.conn;

  if (!communicationsCache.promise) {
    communicationsCache.promise = mongoose
      .createConnection(uri, stateConnectionOptions)
      .asPromise()
      .then((connection) => {
        communicationsCache.conn = connection;
        return connection;
      });
  }

  return communicationsCache.promise;
}

export function getConfiguredStateCodes(): string[] {
  return Object.keys(process.env)
    .filter((key) => key.startsWith("MONGODB_STATE_") && key.endsWith("_URI"))
    .map((key) => key.slice("MONGODB_STATE_".length, -"_URI".length))
    .filter(Boolean)
    .sort();
}
