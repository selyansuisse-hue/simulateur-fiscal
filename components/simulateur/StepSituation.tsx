'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function StepSituation() {
  const { params, setParam, nextStep } = useSimulateur()

  return (
    <div className="animate-stepIn">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 rounded-full border border-blue/20 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-blue" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-blue">Étape 1 sur 4</span>
        </div>
        <h2 className="font-display text-3xl font-black text-ink tracking-tight mb-2">Votre situation</h2>
        <p className="text-[14.5px] text-ink3 leading-relaxed max-w-md">Ces informations adaptent le questionnaire et déterminent les structures applicables à votre profil.</p>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-2xl p-7 mb-4 shadow-card-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="4.5" r="2.5" stroke="#2563EB" strokeWidth="1.5"/>
              <path d="M2 12.5C2 10.015 4.239 8 7 8s5 2.015 5 4.5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Contexte du projet</div>
            <div className="text-[11.5px] text-ink4">Votre point de départ et vos priorités</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Situation</Label>
            <Select value={params.situation} onValueChange={v => setParam('situation', v as typeof params.situation)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="creation">Création d&apos;entreprise</SelectItem>
                <SelectItem value="existant">Structure existante — optimisation</SelectItem>
                <SelectItem value="changement">Changement de forme juridique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Secteur d&apos;activité</Label>
            <Select value={params.secteur} onValueChange={v => setParam('secteur', v as typeof params.secteur)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="services_bic">Prestations de services BIC</SelectItem>
                <SelectItem value="liberal_bnc">Professions libérales / BNC</SelectItem>
                <SelectItem value="commerce">Commerce / négoce / e-commerce</SelectItem>
                <SelectItem value="btp">BTP / artisanat / restauration</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-ink4 leading-relaxed">Détermine le régime micro applicable et le taux d&apos;abattement</p>
          </div>
        </div>

        {params.situation !== 'creation' && (
          <div className="flex flex-col gap-2 mb-5">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Forme juridique actuelle</Label>
            <Select value={params.formeActuelle} onValueChange={v => setParam('formeActuelle', v as typeof params.formeActuelle)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Priorité principale</Label>
            <Select value={params.priorite} onValueChange={v => setParam('priorite', v as typeof params.priorite)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equilibre">Équilibre revenu / protection sociale</SelectItem>
                <SelectItem value="net">Maximiser le revenu net immédiat</SelectItem>
                <SelectItem value="protection">Priorité protection sociale (retraite, IJ)</SelectItem>
                <SelectItem value="simplicite">Simplicité administrative (coûts réduits)</SelectItem>
                <SelectItem value="croissance">Croissance / levée de fonds future</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-ink4 leading-relaxed">Influence le score multicritère et la recommandation finale</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Nombre d&apos;associés</Label>
            <Select defaultValue="1">
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Dirigeant seul</SelectItem>
                <SelectItem value="2">2 associés</SelectItem>
                <SelectItem value="3p">3 ou plus</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-ink4 leading-relaxed">EURL et SASU sont réservées à l&apos;associé unique</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center mt-8 pt-6 border-t border-surface2">
        <button
          onClick={nextStep}
          className="group inline-flex items-center gap-2 px-7 py-3 bg-blue text-white font-bold text-sm rounded-xl
            shadow-[0_4px_14px_rgba(29,78,216,.35)] hover:bg-blue-dark
            hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(29,78,216,.42)]
            transition-all duration-150"
        >
          Continuer
          <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </div>
  )
}
