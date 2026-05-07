-- Migration: intention de changement sur leads (chaleur du prospect)
-- Date: 2025-05-07

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS intention TEXT; -- 'urgent' | 'reflechis' | 'info'

-- Index pour filtrer par intention dans le dashboard
CREATE INDEX IF NOT EXISTS leads_intention_idx ON leads(intention)
  WHERE intention IS NOT NULL;
