import type { Lead, LeadStatut } from './types/cabinet'

// ─────────────────────────────────────────────────────────
// Scoring de chaleur 0-100
// ─────────────────────────────────────────────────────────
export function calculateLeadScore(lead: Lead): number {
  let score = 0

  // Récence (40 pts max) — basé sur dernière simulation ou création
  const ref = lead.derniere_simulation || lead.created_at
  const jours = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
  if (jours <= 1) score += 40
  else if (jours <= 3) score += 30
  else if (jours <= 7) score += 20
  else if (jours <= 14) score += 10

  // Gain potentiel (30 pts max)
  const gain = lead.gain_vs_pire ?? 0
  if (gain > 20_000) score += 30
  else if (gain > 10_000) score += 20
  else if (gain > 5_000) score += 10

  // Intention déclarée (20 pts max)
  if (lead.intention === 'urgent') score += 20
  else if (lead.intention === 'reflechis') score += 10

  // Nb simulations (10 pts max)
  const nbSims = lead.nb_simulations ?? 0
  if (nbSims >= 3) score += 10
  else if (nbSims >= 2) score += 5

  return Math.min(score, 100)
}

// ─────────────────────────────────────────────────────────
// Badge chaleur
// ─────────────────────────────────────────────────────────
export function getChaleurBadge(score: number) {
  if (score >= 70) return {
    label: '🔥 Chaud', emoji: '🔥',
    bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)',
  }
  if (score >= 40) return {
    label: '🟡 Tiède', emoji: '🟡',
    bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)',
  }
  return {
    label: '🔵 Froid', emoji: '🔵',
    bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)',
  }
}

// ─────────────────────────────────────────────────────────
// Alerte relance
// ─────────────────────────────────────────────────────────
export function getAlerteRelance(
  lead: Lead
): { message: string; couleur: 'red' | 'amber'; urgence: boolean } | null {
  if (lead.statut === 'converti' || lead.statut === 'perdu') return null

  const ref = lead.derniere_relance || lead.created_at
  const jours = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)

  if (lead.statut === 'nouveau' && jours > 3) {
    return { message: `Non contacté depuis ${jours}j`, couleur: 'red', urgence: true }
  }
  if ((lead.statut === 'contacté' || lead.statut === 'rdv_planifie') && jours > 7) {
    return { message: `Relance nécessaire (${jours}j)`, couleur: 'amber', urgence: false }
  }
  return null
}

// ─────────────────────────────────────────────────────────
// Statut suivant dans le pipeline
// ─────────────────────────────────────────────────────────
export const NEXT_STATUT: Partial<Record<LeadStatut, LeadStatut>> = {
  nouveau: 'contacté',
  contacté: 'rdv_planifie',
  rdv_planifie: 'converti',
}

// ─────────────────────────────────────────────────────────
// Top structure
// ─────────────────────────────────────────────────────────
export function getTopStructure(leads: Lead[]): string {
  const counts: Record<string, number> = {}
  for (const l of leads) {
    if (l.structure_recommandee) {
      counts[l.structure_recommandee] = (counts[l.structure_recommandee] || 0) + 1
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? top[0].replace(' / SARL (IS)', '').replace(' / SASU', '') : '—'
}
