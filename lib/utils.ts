import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + '\u00a0€'
}

export function fmtM(n: number): string {
  return Math.round(n / 12).toLocaleString('fr-FR') + '\u00a0€/mois'
}

export function fmtK(n: number): string {
  return Math.round(n / 1000) + 'k€'
}
