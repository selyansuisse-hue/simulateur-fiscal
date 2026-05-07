-- Migration CRM enrichi : nouvelles colonnes sur leads
-- Date: 2025-05-07

ALTER TABLE leads ADD COLUMN IF NOT EXISTS derniere_relance TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS honoraires NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gain_vs_pire NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nb_simulations INT DEFAULT 0;

-- Index pour trier par score de chaleur (récence)
CREATE INDEX IF NOT EXISTS leads_derniere_simulation_idx ON leads(derniere_simulation DESC NULLS LAST)
  WHERE derniere_simulation IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_derniere_relance_idx ON leads(derniere_relance DESC NULLS LAST)
  WHERE derniere_relance IS NOT NULL;
