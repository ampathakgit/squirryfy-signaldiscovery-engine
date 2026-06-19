-- Migration: Add logs column to instagram_posts table
ALTER TABLE "public"."instagram_posts" ADD COLUMN IF NOT EXISTS "logs" TEXT[] DEFAULT '{}';
