-- Migration: Add sequence-backed product code generation
-- Run once: psql -d your_database -f this_file.sql

CREATE SEQUENCE IF NOT EXISTS product_code_seq START 1 INCREMENT 1 NO CYCLE;

WITH current_sequence AS (
  SELECT last_value, is_called FROM product_code_seq
),
next_code AS (
  SELECT COALESCE(MAX(SUBSTRING(code FROM 2)::INTEGER), 0) + 1 AS value
  FROM products
  WHERE code ~ '^P[0-9]+$'
)
SELECT setval(
  'product_code_seq',
  GREATEST(
    (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM current_sequence),
    (SELECT value FROM next_code),
    1
  ),
  false
);
