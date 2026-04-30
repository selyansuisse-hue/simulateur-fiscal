-- Ajoute contrainte unique (cabinet_id, email) sur leads
-- Permet l'upsert "un lead par email par cabinet" : chaque simulation
-- sauvegardée met à jour le lead existant plutôt d'en créer un doublon.

-- Supprimer les éventuels doublons avant d'appliquer la contrainte
DELETE FROM leads a
USING leads b
WHERE a.id > b.id
  AND a.cabinet_id = b.cabinet_id
  AND a.email = b.email
  AND a.email IS NOT NULL;

ALTER TABLE leads
  ADD CONSTRAINT leads_cabinet_email_unique UNIQUE (cabinet_id, email);

-- Ajouter updated_at pour tracer les mises à jour
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
