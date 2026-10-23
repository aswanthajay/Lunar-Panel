
-- =====================================================================
-- Pterodactyl (MySQL) to Votion 2.0 (PostgreSQL) Migration Script
-- =====================================================================

-- 1. Migrate Users (Passwords preserved as-is: bcrypt hashes match)
INSERT INTO "User" ("id", "email", "username", "passwordHash", "role", "createdAt", "updatedAt")
SELECT 
    uuid AS "id",
    email,
    username,
    password AS "passwordHash",
    CASE WHEN root_admin = 1 THEN 'ADMIN'::"Role" ELSE 'USER'::"Role" END AS "role",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
FROM pterodactyl_users_import
ON CONFLICT ("email") DO NOTHING;

-- 2. Migrate Nodes
INSERT INTO "Node" ("id", "name", "fqdn", "daemonPort", "wsPort", "memoryLimitBytes", "diskLimitBytes", "cpuCores", "active", "apiKey", "createdAt", "updatedAt")
SELECT 
    uuid AS "id",
    name,
    fqdn,
    daemonListen AS "daemonPort",
    daemonSFTP AS "wsPort",
    (memory * 1024 * 1024)::bigint AS "memoryLimitBytes",
    (disk * 1024 * 1024)::bigint AS "diskLimitBytes",
    4 AS "cpuCores",
    true AS "active",
    daemon_token AS "apiKey",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
FROM pterodactyl_nodes_import
ON CONFLICT ("id") DO NOTHING;

-- 3. Migrate Servers
INSERT INTO "Server" (
    "id", "identifier", "name", "description", "state", 
    "ownerId", "nodeId", "eggId", "dockerImage", "startupCommand", 
    "cpuWeight", "cpuLimitPercent", "memoryLimitBytes", "memoryHighBytes", 
    "memorySwapBytes", "diskLimitBytes", "ioWeight", "hibernationEnabled", 
    "idleTimeoutSeconds", "wakeOnPacket", "stopSignal", "stopTimeoutSeconds", 
    "createdAt", "updatedAt"
)
SELECT 
    s.uuid AS "id",
    s.uuidShort AS "identifier",
    s.name,
    s.description,
    'STOPPED'::"ServerState" AS "state",
    s.owner_id AS "ownerId",
    s.node_id AS "nodeId",
    s.egg_id AS "eggId",
    s.image AS "dockerImage",
    s.startup AS "startupCommand",
    100 AS "cpuWeight",
    s.cpu AS "cpuLimitPercent",
    (s.memory * 1024 * 1024)::bigint AS "memoryLimitBytes",
    ((s.memory * 0.9) * 1024 * 1024)::bigint AS "memoryHighBytes",
    (s.swap * 1024 * 1024)::bigint AS "memorySwapBytes",
    (s.disk * 1024 * 1024)::bigint AS "diskLimitBytes",
    500 AS "ioWeight",
    true AS "hibernationEnabled",
    300 AS "idleTimeoutSeconds",
    true AS "wakeOnPacket",
    'SIGTERM' AS "stopSignal",
    30 AS "stopTimeoutSeconds",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"
FROM pterodactyl_servers_import s
ON CONFLICT ("id") DO NOTHING;
