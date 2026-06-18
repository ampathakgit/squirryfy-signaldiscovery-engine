-- Migration: Add squirry_response JSONB column to discovery_final_signals table
ALTER TABLE "public"."discovery_final_signals" ADD COLUMN IF NOT EXISTS "squirry_response" JSONB;
