-- Migration: Create instagram_posts table to track generated carousels and publishing state
CREATE TABLE IF NOT EXISTS "public"."instagram_posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signal_id" TEXT REFERENCES "public"."discovery_final_signals"("signal_id") ON DELETE SET NULL,
  "instagram_media_id" TEXT UNIQUE,
  "status" TEXT NOT NULL, -- 'PENDING', 'GENERATED', 'PUBLISHED', 'FAILED'
  "carousel_data" JSONB, -- Stores copywriting and slide config details
  "media_urls" TEXT[], -- URLs of the generated slide images stored in Supabase
  "post_url" TEXT, -- Direct link to the live instagram post
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
