-- Migration: Add is_hidden column to users table for hidden maintenance accounts
-- Purpose: Allow marking users as hidden so they don't appear in the admin dashboard

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
