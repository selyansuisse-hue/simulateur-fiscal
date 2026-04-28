export type Plan = 'starter' | 'pro' | 'cabinet_plus'
export type LeadStatut = 'nouveau' | 'contacté' | 'converti' | 'perdu'
export type LeadSource = 'widget' | 'direct' | 'partage'
export type MembreRole = 'admin' | 'membre'

export interface Cabinet {
  id: string
  nom: string
  slug: string
  email_contact: string
  logo_url: string | null
  couleur_principale: string
  couleur_secondaire: string
  plan: Plan
  actif: boolean
  created_at: string
}

export interface Lead {
  id: string
  cabinet_id: string
  nom: string | null
  email: string | null
  telephone: string | null
  ca_simule: number | null
  structure_recommandee: string | null
  net_annuel: number | null
  score: number | null
  simulation_data: Record<string, unknown> | null
  statut: LeadStatut
  source: LeadSource
  created_at: string
}

export interface CabinetMembre {
  id: string
  cabinet_id: string
  user_id: string
  role: MembreRole
  created_at: string
  profiles?: { full_name: string | null; email: string | null }
}
