'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function StepSituation() {
  const { params, setParam, nextStep } = useSimulateur()

  return (
    <div className="animate-stepIn">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-ink tracking-tight mb-1">Votre situation</h2>
        <p className="text-sm text-ink3">Ces informations adaptent le questionnaire et déterminent les structures applicables.</p>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-0.5 h-5 rounded-full bg-blue" />
          <span className="text-sm font-semibold text-ink2">Contexte du projet</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Situation</Label>
            <Select value={params.situation} onValueChange={v => setParam('situation', v as typeof params.situation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="creation">Création d&apos;entreprise</SelectItem>
                <SelectItem value="existant">Structure existante — optimisation</SelectItem>
                <SelectItem value="changement">Changement de forme juridique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Secteur d&apos;activité</Label>
            <Select value={params.secteur} onValueChange={v => setParam('secteur', v as typeof params.secteur)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="services_bic">Prestations de services BIC</SelectItem>
                <SelectItem value="liberal_bnc">Professions libérales / BNC</SelectItem>
                <SelectItem value="commerce">Commerce / négoce / e-commerce</SelectItem>
                <SelectItem value="btp">BTP / artisanat / restauration</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-ink4">Détermine le régime micro applicable et le taux d&apos;abattement</p>
          </div>
        </div>

        {params.situation !== 'creation' && (
          <div className="flex flex-col gap-2 mb-4">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Forme juridique actuelle</Label>
            <Select value={params.formeActuelle} onValueChange={v => setParam('formeActuelle', v as typeof params.formeActuelle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non précisé</SelectItem>
                <SelectItem value="micro">Micro-entreprise</SelectItem>
                <SelectItem value="ei">EI (régime réel)</SelectItem>
                <SelectItem value="eurl_is">EURL / SARL IS</SelectItem>
                <SelectItem value="sas_sasu">SAS / SASU</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Priorité principale</Label>
            <Select value={params.priorite} onValueChange={v => setParam('priorite', v as typeof params.priorite)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equilibre">Équilibre revenu / protection sociale</SelectItem>
                <SelectItem value="net">Maximiser le revenu net immédiat</SelectItem>
                <SelectItem value="protection">Priorité protection sociale (retraite, IJ)</SelectItem>
                <SelectItem value="simplicite">Simplicité administrative (coûts réduits)</SelectItem>
                <SelectItem value="croissance">Croissance / levée de fonds future</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-ink4">Influence le score multicritère et la recommandation finale</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Nombre d&apos;associés</Label>
            <Select defaultValue="1">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Dirigeant seul</SelectItem>
                <SelectItem value="2">2 associés</SelectItem>
                <SelectItem value="3p">3 ou plus</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-ink4">EURL et SASU sont réservées à l&apos;associé unique</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 pt-5 border-t border-surface2">
        <span className="text-xs text-ink4">Étape 1 sur 5</span>
        <button
          onClick={nextStep}
          className="px-6 py-2.5 bg-blue text-white font-semibold text-sm rounded-lg
            shadow-[0_2px_6px_rgba(29,78,216,.3)] hover:bg-blue-dark
            hover:-translate-y-px hover:shadow-[0_6px_22px_rgba(29,78,216,.38)]
            transition-all duration-150"
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}
