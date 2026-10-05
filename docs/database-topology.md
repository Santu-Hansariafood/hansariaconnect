# Production Database Topology

The application uses a control database plus state databases.

## Control database

Set `MONGODB_CONTROL_URI` to the MongoDB Atlas URI for the control database. `MONGODB_URI` remains supported as a backward-compatible fallback.

The control database stores identity and routing metadata such as users, sessions, admins, profiles, and the user's `stateCode`.

## State databases

Add one server-only environment variable per enabled state:

```env
MONGODB_STATE_MH_URI=mongodb+srv://...
MONGODB_STATE_DL_URI=mongodb+srv://...
MONGODB_STATE_KA_URI=mongodb+srv://...
MONGODB_COMMUNICATIONS_URI=mongodb+srv://...
```

State databases must use the same local-data indexes. Cross-state conversations use the communications database configured by `MONGODB_COMMUNICATIONS_URI`, which owns messages, groups, conversations, and read receipts that cross state boundaries. `MONGODB_STATE_POOL_SIZE` and `MONGODB_STATE_MIN_POOL_SIZE` control each state's connection pool.

`connectStateDB(stateCode)` and `connectCommunicationsDB()` in `lib/db/db.ts` validate and pool connections. Request handlers must resolve the user's state from the control database and use a connection-bound model before reading or writing state data. Never accept a database URI or database name from a browser request.

## Migration rules

1. Add `stateCode` to existing users before enabling state writes.
2. Backfill each user's messages and related records into the selected state database.
3. Verify counts and indexes for every state database.
4. Enable state reads and writes behind a deployment flag.
5. Keep the control database as the source of truth for user-to-state routing.
6. Do not move a user between states without an explicit data migration.

Users without a `stateCode` remain legacy users and must be assigned before state-routed chat access is enabled.

## Socket.IO across VPS instances

Set `REDIS_URL` (or the `REDIS_HOST` connection settings) on every app instance to the same private, authenticated Redis service. Socket.IO uses the Redis adapter for room broadcasts and expiring Redis presence leases. `SOCKET_IO_REDIS_KEY` can isolate this app from other Socket.IO deployments sharing Redis. If Redis is configured but unavailable during startup, `/api/socket` returns `503` and clients retry; without Redis configured, realtime delivery is single-instance only.

When the load balancer permits Engine.IO polling, enable sticky sessions so all polling requests in one Socket.IO session reach the same app instance. Forward WebSocket `Upgrade` and `Connection` headers, allow long-lived connections, and configure `NEXT_PUBLIC_APP_URL` to the public app origin. Admin, super-admin, and web subdomains of that origin are accepted by the socket origin check.

For multiple geographic regions, use a low-latency Redis deployment shared by every instance that must exchange socket events, and account for cross-region latency/failure domains. Separate regional Redis clusters do not provide global room delivery by themselves. Regional message databases also require state-aware request routing; the connection helpers alone do not route chat data.
