-- ============================================================
-- B2B SaaS Layer — Cabinets, Leads, Membres
-- ============================================================

CREATE TABLE IF NOT EXISTS cabinets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email_contact TEXT NOT NULL,
  logo_url TEXT,
  couleur_principale TEXT DEFAULT '#3B82F6',
  couleur_secondaire TEXT DEFAULT '#8B5CF6',
  plan TEXT DEFAULT 'starter',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID REFERENCES cabinets(id) ON DELETE CASCADE,
  nom TEXT,
  email TEXT,
  telephone TEXT,
  ca_simule NUMERIC,
  structure_recommandee TEXT,
  net_annuel NUMERIC,
  score NUMERIC,
  simulation_data JSONB,
  statut TEXT DEFAULT 'nouveau',
  source TEXT DEFAULT 'widget',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cabinet_membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID REFERENCES cabinets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'membre',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cabinet_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_cabinet_id ON leads(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_statut ON leads(statut);
CREATE INDEX IF NOT EXISTS idx_cabinet_membres_user_id ON cabinet_membres(user_id);
CREATE INDEX IF NOT EXISTS idx_cabinets_slug ON cabinets(slug);

-- RLS
ALTER TABLE cabinets ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cabinet_membres ENABLE ROW LEVEL SECURITY;

-- Leads: membres voient/modifient les leads de leur cabinet
CREATE POLICY "leads_cabinet_all" ON leads
  FOR ALL USING (
    cabinet_id IN (
      SELECT cabinet_id FROM cabinet_membres
      WHERE user_id = auth.uid()
    )
  );

-- Cabinets: membres voient leur cabinet
CREATE POLICY "cabinet_select_member" ON cabinets
  FOR SELECT USING (
    id IN (
      SELECT cabinet_id FROM cabinet_membres
      WHERE user_id = auth.uid()
    )
  );

-- Cabinets: admins peuvent modifier
CREATE POLICY "cabinet_update_admin" ON cabinets
  FOR UPDATE USING (
    id IN (
      SELECT cabinet_id FROM cabinet_membres
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- cabinet_membres: membres voient les membres de leur cabinet
CREATE POLICY "cabinet_membres_select" ON cabinet_membres
  FOR SELECT USING (
    cabinet_id IN (
      SELECT cabinet_id FROM cabinet_membres cm2
      WHERE cm2.user_id = auth.uid()
    )
  );
