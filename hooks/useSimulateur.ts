'use client'
import { create } from 'zustand'
import { SimParams, StructureResult, MICRO_PLAFONDS, Secteur } from '@/lib/fiscal'
import { calcPartsTotal } from '@/lib/fiscal/ir'
import { runSimulation } from '@/lib/fiscal/structures'

export interface SimulateurState {
  step: number
  params: SimParams
  results: ReturnType<typeof runSimulation> | null
  isCalculated: boolean
}

interface SimulateurActions {
  setStep: (s: number) => void
  nextStep: () => void
  prevStep: () => void
  setParam: <K extends keyof SimParams>(key: K, value: SimParams[K]) => void
  setParams: (partial: Partial<SimParams>) => void
  calcul: () => void
  reset: () => void
}

const defaultParams: SimParams = {
  ca: 120000,
  charges: 20000,
  amort: 5000,
  deficit: 0,
  capital: 10000,
  abat: 0.50,
  remNetAnn: 48000,
  partsBase: 1,
  nbEnfants: 0,
  parts: 1,
  autresRev: 0,
  prevoy: 'min',
  priorite: 'equilibre',
  situation: 'creation',
  secteur: 'services_bic',
  formeActuelle: 'none',
  reserves: 0,
  remActuelle: 0,
  stratActif: 'max',
  reserveVoulue: 0,
  stratRaison: 'invest',
  perActif: 'non',
  perMontant: 0,
  mutuelleMontant: 0,
  prevoyanceMontant: 0,
}

export const useSimulateur = create<SimulateurState & SimulateurActions>((set, get) => ({
  step: 0,
  params: { ...defaultParams },
  results: null,
  isCalculated: false,

  setStep: (s) => set({ step: s }),
  nextStep: () => set(state => ({ step: Math.min(4, state.step + 1) })),
  prevStep: () => set(state => ({ step: Math.max(0, state.step - 1) })),

  setParam: (key, value) => set(state => {
    const next = { ...state.params, [key]: value }
    // Auto-update derived fields
    if (key === 'secteur') {
      const cfg = MICRO_PLAFONDS[value as Secteur]
      if (next.ca <= cfg.plafond) next.abat = cfg.abat
      else next.abat = 0
    }
    if (key === 'ca' || key === 'secteur') {
      const cfg = MICRO_PLAFONDS[next.secteur]
      if (next.ca > cfg.plafond) next.abat = 0
      else next.abat = cfg.abat
    }
    if (key === 'partsBase' || key === 'nbEnfants') {
      next.parts = calcPartsTotal(next.partsBase, next.nbEnfants)
    }
    return { params: next }
  }),

  setParams: (partial) => set(state => {
    const next = { ...state.params, ...partial }
    next.parts = calcPartsTotal(next.partsBase, next.nbEnfants)
    return { params: next }
  }),

  calcul: () => {
    const { params } = get()
    try {
      const results = runSimulation(params)
      set({ results, isCalculated: true })
    } catch (e) {
      console.error('Calcul error', e)
    }
  },

  reset: () => set({ step: 0, params: { ...defaultParams }, results: null, isCalculated: false }),
}))
