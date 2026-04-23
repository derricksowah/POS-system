-- Migration: Add split payments, sale-item discount metadata, and stock-in edit support

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momo_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE sales
SET
  cash_amount = CASE
    WHEN payment_method = 'cash' THEN COALESCE(amount_tendered, 0)
    ELSE cash_amount
  END,
  momo_amount = CASE
    WHEN payment_method = 'momo' THEN COALESCE(amount_tendered, 0)
    ELSE momo_amount
  END
WHERE cash_amount = 0 AND momo_amount = 0;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS original_unit_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE sale_items
SET original_unit_price = unit_price
WHERE original_unit_price IS NULL;

ALTER TABLE sale_items
  ALTER COLUMN original_unit_price SET NOT NULL;

ALTER TABLE stock_ins
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_stock_ins_updated_at ON stock_ins;
CREATE TRIGGER trg_stock_ins_updated_at
    BEFORE UPDATE ON stock_ins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
