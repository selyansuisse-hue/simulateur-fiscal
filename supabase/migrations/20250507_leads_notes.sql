-- Migration: colonne notes sur leads + updated_at si absent
-- Date: 2025-05-07

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
