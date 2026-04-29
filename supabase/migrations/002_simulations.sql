-- Table simulations utilisateurs
CREATE TABLE IF NOT EXISTS simulations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Simulation sans titre',
  params          JSONB,
  results         JSONB,
  best_forme      TEXT,
  best_net_annuel NUMERIC,
  best_net_mois   NUMERIC,
  best_ir         NUMERIC,
  tmi             NUMERIC,
  ca              NUMERIC,
  situation       TEXT,
  parts           NUMERIC,
  per_montant     NUMERIC DEFAULT 0,
  gain            NUMERIC,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulations_user_all" ON simulations
  FOR ALL USING (user_id = auth.uid());

-- Table profiles (prénom pour dashboard)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_user_all" ON profiles
  FOR ALL USING (id = auth.uid());

-- Trigger pour créer le profil automatiquement à chaque signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
