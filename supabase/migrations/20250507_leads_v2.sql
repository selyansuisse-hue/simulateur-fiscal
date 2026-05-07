-- Migration: leads v2 + lead_simulations
-- Date: 2025-05-07
-- Description: Ajout user_id, source étendue, score, derniere_simulation sur leads
--              Création de la table lead_simulations (jointure leads <-> simulations)

-- ─────────────────────────────────────────────────────────
-- 1. Mise à jour de la table leads
-- ─────────────────────────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS derniere_simulation TIMESTAMPTZ;

-- Étendre le domaine de la colonne source si elle est un ENUM
-- (Si source est TEXT, les lignes suivantes sont inutiles mais inoffensives)
DO $$
BEGIN
  -- Ajouter les nouvelles valeurs si source est un type ENUM
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'lead_source'
  ) THEN
    BEGIN ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'inscription'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'simulation_enregistree'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END
$$;

-- Index pour retrouver les leads par user
CREATE INDEX IF NOT EXISTS leads_user_id_idx ON leads(user_id);

-- ─────────────────────────────────────────────────────────
-- 2. Création de la table lead_simulations
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_simulations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  simulation_id  UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, simulation_id)
);

-- Index de performance
CREATE INDEX IF NOT EXISTS lead_simulations_lead_id_idx       ON lead_simulations(lead_id);
CREATE INDEX IF NOT EXISTS lead_simulations_simulation_id_idx ON lead_simulations(simulation_id);

-- ─────────────────────────────────────────────────────────
-- 3. RLS sur lead_simulations
-- ─────────────────────────────────────────────────────────

ALTER TABLE lead_simulations ENABLE ROW LEVEL SECURITY;

-- Les membres cabinet peuvent voir les lead_simulations de leurs leads
CREATE POLICY "cabinet_membres_can_select_lead_simulations"
  ON lead_simulations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM leads l
      JOIN cabinet_membres cm ON cm.cabinet_id = l.cabinet_id
      WHERE l.id = lead_simulations.lead_id
        AND cm.user_id = auth.uid()
    )
  );

-- L'owner d'une simulation peut voir ses propres liaisons
CREATE POLICY "owner_can_select_own_lead_simulations"
  ON lead_simulations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM simulations s
      WHERE s.id = lead_simulations.simulation_id
        AND s.user_id = auth.uid()
    )
  );

-- Seul le service role peut insérer (via API backend)
-- (pas de policy INSERT = seul le service role peut écrire)
