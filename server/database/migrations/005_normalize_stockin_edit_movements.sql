-- Migration: Make previous stock-in edit movements count in Purchases / In

UPDATE stock_movements
SET type = 'purchase'
WHERE type = 'adjustment'
  AND note LIKE 'Stock-in edit:%';
