/* Shared types and helpers between page.tsx (server) and LeadDetailClient.tsx (client) */

export interface Simulation {
  id: string
  name: string
  ca: number | null
  best_forme: string | null
  best_net_annuel: number | null
  best_net_mois: number | null
  tmi: number | null
  score: number | null
  gain: number | null
  situation: string | null
  created_at: string
  params: Record<string, unknown> | null
}

export interface ComparisonRow {
  forme: string
  netAnnuel: number
  charges: number
  ir: number
  is: number
  score: number
  ineligible?: boolean
  isRecommended?: boolean
}

export interface Insight {
  icon: string
  message: string
  priorite: 'urgente' | 'haute' | 'moyenne'
  couleur: string
  couleurBg: string
  couleurBorder: string
}

export const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94A3B8',
}

export function structColor(forme: string | null): string {
  return forme ? (STRUCT_COLORS[forme] ?? '#64748B') : '#64748B'
}

export function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)
}

const AVATAR_PALETTES = [
  'linear-gradient(135deg,#3B82F6,#6366F1)',
  'linear-gradient(135deg,#8B5CF6,#EC4899)',
  'linear-gradient(135deg,#06B6D4,#3B82F6)',
  'linear-gradient(135deg,#10B981,#06B6D4)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#6366F1,#8B5CF6)',
  'linear-gradient(135deg,#EF4444,#EC4899)',
  'linear-gradient(135deg,#F59E0B,#10B981)',
]

export function avatarGrad(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]
}

export function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'
}
