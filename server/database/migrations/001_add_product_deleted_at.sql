-- Migration: Add soft-delete support to products
-- Run once: psql -d your_database -f this_file.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
