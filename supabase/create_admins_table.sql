-- Create discovery_admins table to store authenticated dashboard users
CREATE TABLE IF NOT EXISTS "public"."discovery_admins" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" TEXT UNIQUE NOT NULL,
  "password_hash" TEXT NOT NULL,
  "salt" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index username for fast lookups
CREATE INDEX IF NOT EXISTS idx_discovery_admins_username ON "public"."discovery_admins"("username");
