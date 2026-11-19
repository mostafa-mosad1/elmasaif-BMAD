-- Migration: 20261119_add_default_role_to_preferences
-- Adds default_role column to user_preferences table

ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "default_role" "UserRole" NOT NULL DEFAULT 'BUYER';

