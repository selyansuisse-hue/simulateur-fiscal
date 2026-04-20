# Simulateur Fiscal — Belho Xper

Application Next.js 14 comparant 4 structures juridiques françaises (Micro, EI, EURL/SARL IS, SAS/SASU) avec les calculs fiscaux 2025.

## Stack

- **Framework** : Next.js 14 (App Router)
- **Base de données** : Supabase (PostgreSQL + Auth)
- **Styling** : Tailwind CSS
- **State** : Zustand
- **PDF** : Puppeteer (côté serveur)
- **Déploiement** : Vercel

## Fonctionnalités

- ✅ Simulateur 4 étapes (Situation → Activité → Rémunération → Foyer → Résultats)
- ✅ Calculs fiscaux 2025 : barème IR, QF (1 807 €/demi-part), décote, cotisations SSI par composante, IS 15%/25%
- ✅ Score multicritère (revenu net, protection sociale, simplicité, croissance)
- ✅ SWOT, leviers d'optimisation, plan d'action
- ✅ Auth Supabase (email/password + magic link)
- ✅ Sauvegarde des simulations (max 20/utilisateur)
- ✅ Dashboard avec stats et comparaison
- ✅ Génération PDF via Puppeteer
- ✅ Design inspiré de Belho Xper (palette navy/blue)

## Démarrage rapide

### 1. Cloner & installer

```bash
git clone <repo>
cd simulateur-fiscal
npm install
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Remplissez `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Configurer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL, exécutez `supabase/schema.sql`
3. Dans **Authentication > URL Configuration**, ajoutez `http://localhost:3000` aux redirect URLs

### 4. Lancer en développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## Déploiement Vercel

1. Importez le repo dans Vercel
2. Ajoutez les variables d'environnement dans les settings Vercel
3. Dans Supabase, ajoutez votre domaine Vercel aux redirect URLs

```
https://votre-domaine.vercel.app
```

## Architecture du projet

```
simulateur-fiscal/
├── app/                          # Pages Next.js (App Router)
│   ├── page.tsx                  # Landing page
│   ├── simulateur/page.tsx       # Simulateur (public)
│   ├── auth/login/page.tsx       # Connexion
│   ├── auth/signup/page.tsx      # Inscription
│   ├── dashboard/page.tsx        # Dashboard (auth)
│   ├── simulations/              # Liste + détail simulations
│   ├── profil/page.tsx           # Profil utilisateur
│   └── api/simulations/          # API REST
├── components/
│   ├── simulateur/               # StepSituation, StepActivite, etc.
│   ├── dashboard/                # SimulationCard, CompareTable, etc.
│   └── ui/                       # PageHeader, Footer, Select, etc.
├── hooks/
│   └── useSimulateur.ts          # Store Zustand
├── lib/
│   ├── fiscal/                   # Logique fiscale TypeScript
│   │   ├── types.ts              # Interfaces & types
│   │   ├── ir.ts                 # Barème IR 2025, décote, QF
│   │   ├── cotisations.ts        # Cotisations TNS SSI 2025
│   │   └── structures.ts         # calcMicro, calcEIReel, calcEURL, calcSASU
│   └── supabase/                 # Client browser & server
└── supabase/
    └── schema.sql                # Tables, RLS, triggers
```

## Logique fiscale 2025

### Barème IR (`lib/fiscal/ir.ts`)
- Tranches : 0%, 11%, 30%, 41%, 45%
- Décote : 873 € - 45.25% × IR brut
- QF plafond : **1 807 €/demi-part** (LFI 2026, revenus 2025)
- Parts enfants : 0,5 part (1er et 2ème), 1 part (3ème+)

### Cotisations TNS SSI (`lib/fiscal/cotisations.ts`)
- PASS 2025 = **46 368 €**
- Maladie-maternité, IJ, retraite base, RCI, invalidité-décès, AF, CFP, CSG/CRDS
- Taux dégressifs selon le revenu par composante

### IS (`lib/fiscal/cotisations.ts`)
- **15%** sur les 42 500 premiers € de résultat
- **25%** au-delà

### Structures (`lib/fiscal/structures.ts`)
- **Micro** : cotisations 24,6% du CA, abattement forfaitaire
- **EI réel** : bisection pour cotisations TNS, déduction PER
- **EURL** : bisection rem+cotis=capa, seuil dividendes 10% capital
- **SASU** : optimisation brut × ratio div, patronales 42%, salariales 22%

## Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (API server uniquement) | ✅ |
| `NEXT_PUBLIC_APP_URL` | URL de l'application | ✅ |

---

© 2025 Belho Xper · Cabinet d'expertise comptable · Lyon & Montluel  
*Simulation indicative — non contractuelle*
