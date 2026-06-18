-- Squirryfy Signal Discovery Engine database schema script
-- Execute this script in your Supabase SQL Editor to initialize the isolated tables in the public schema.

-- 1. Regions
CREATE TABLE IF NOT EXISTS "public"."discovery_regions" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "languages" TEXT[] NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS "public"."discovery_categories" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "default_top_n" INTEGER NOT NULL DEFAULT 3,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ingestion Sources
CREATE TABLE IF NOT EXISTS "public"."discovery_sources" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- ARTICLE, VIDEO, SOCIAL, TREND, FORUM, OFFICIAL, RSS
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Category-Region Keyword Rules Configs
CREATE TABLE IF NOT EXISTS "public"."discovery_category_region_configs" (
  "region_id" TEXT NOT NULL REFERENCES "public"."discovery_regions"("id") ON DELETE CASCADE,
  "category_id" TEXT NOT NULL REFERENCES "public"."discovery_categories"("id") ON DELETE CASCADE,
  "keywords" TEXT[] NOT NULL,
  "exclude_keywords" TEXT[] NOT NULL DEFAULT '{}',
  "top_n" INTEGER NOT NULL DEFAULT 3,
  "time_window_hours" INTEGER NOT NULL DEFAULT 24,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("region_id", "category_id")
);

-- 5. Ingestion Source Weights Configs
CREATE TABLE IF NOT EXISTS "public"."discovery_source_weight_configs" (
  "region_id" TEXT NOT NULL REFERENCES "public"."discovery_regions"("id") ON DELETE CASCADE,
  "category_id" TEXT NOT NULL REFERENCES "public"."discovery_categories"("id") ON DELETE CASCADE,
  "weights" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("region_id", "category_id")
);

-- 6. Signal Clusters
CREATE TABLE IF NOT EXISTS "public"."discovery_signal_clusters" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "region_id" TEXT NOT NULL REFERENCES "public"."discovery_regions"("id"),
  "category_id" TEXT NOT NULL REFERENCES "public"."discovery_categories"("id"),
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Raw Signals Ingested
CREATE TABLE IF NOT EXISTS "public"."discovery_raw_signals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "region_id" TEXT NOT NULL REFERENCES "public"."discovery_regions"("id"),
  "category_id" TEXT NOT NULL REFERENCES "public"."discovery_categories"("id"),
  "source_id" TEXT NOT NULL REFERENCES "public"."discovery_sources"("id"),
  "source_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "author" TEXT,
  "published_at" TIMESTAMPTZ,
  "raw_text" TEXT,
  "summary" TEXT,
  "engagement" JSONB,
  "metadata" JSONB,
  "normalized" BOOLEAN NOT NULL DEFAULT false,
  "cluster_id" UUID REFERENCES "public"."discovery_signal_clusters"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Discovery Run Session Records
CREATE TABLE IF NOT EXISTS "public"."discovery_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  "signals_found_count" INTEGER NOT NULL DEFAULT 0,
  "signals_clustered_count" INTEGER NOT NULL DEFAULT 0,
  "final_signals_generated_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Final Signals Generated
CREATE TABLE IF NOT EXISTS "public"."discovery_final_signals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signal_id" TEXT UNIQUE NOT NULL,
  "region_id" TEXT NOT NULL REFERENCES "public"."discovery_regions"("id"),
  "category_id" TEXT NOT NULL REFERENCES "public"."discovery_categories"("id"),
  "title" TEXT NOT NULL,
  "article_url" TEXT,
  "canonical_url" TEXT NOT NULL,
  "canonical_source" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "why_selected" TEXT[] NOT NULL,
  "supporting_urls" TEXT[] NOT NULL,
  "entities" TEXT[] NOT NULL,
  "ready_for_squirry_analysis" BOOLEAN NOT NULL DEFAULT true,
  "run_id" UUID NOT NULL REFERENCES "public"."discovery_runs"("id") ON DELETE CASCADE,
  "cluster_id" UUID REFERENCES "public"."discovery_signal_clusters"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Canonical URL Mapping
CREATE TABLE IF NOT EXISTS "public"."discovery_canonical_urls" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "url" TEXT UNIQUE NOT NULL,
  "source_type" TEXT NOT NULL,
  "is_clean" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Custom Scoring rules overrides
CREATE TABLE IF NOT EXISTS "public"."discovery_scoring_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category_id" TEXT UNIQUE REFERENCES "public"."discovery_categories"("id"),
  "weights" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Discovery Run Debug Logs
CREATE TABLE IF NOT EXISTS "public"."discovery_run_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL REFERENCES "public"."discovery_runs"("id") ON DELETE CASCADE,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discovery_raw_signals_region_category ON "public"."discovery_raw_signals"("region_id", "category_id");
CREATE INDEX IF NOT EXISTS idx_discovery_final_signals_region_category ON "public"."discovery_final_signals"("region_id", "category_id");
CREATE INDEX IF NOT EXISTS idx_discovery_raw_signals_url ON "public"."discovery_raw_signals"("url");
