# WPS SIF — Générateur de fichier de paie (UAE)

Application web **full-stack** pour générer des fichiers Excel SIF (Salary Information File) au format UAE WPS (Wages Protection System), à importer ensuite dans l'application bancaire pour effectuer les virements de salaires aux employés.

## Fonctionnalités

- **Multi-entreprise (multi-tenant)** — chaque société gère ses propres employés, isolée des autres
- **Authentification** par email/mot de passe (JWT)
- **Gestion des employés** — ajout, modification, suppression, activation/désactivation
- **Import CSV/Excel en masse** — colonnes : `employee_id, full_name, routing_code, iban, fixed_income, variable_income`
- **Génération du fichier SIF (.xlsx)** au format exact du modèle fourni :
  - Feuille `SIF` avec en-têtes standards
  - Une ligne `EDR` par employé (Employee Detail Record)
  - Une ligne `SCR` de contrôle (Salary Control Record) avec totaux
  - Toutes les valeurs en **texte** pour préserver les zéros de tête et éviter les conversions bancaires
- **Ajustements mensuels** — modifier les montants d'un mois sans toucher la fiche employé
- **Historique** des fichiers générés

## Architecture

```
wps-sif-app/
├── backend/          Node.js + Express + SQLite (better-sqlite3)
│   ├── src/
│   │   ├── server.js
│   │   ├── db/       Base de données SQLite
│   │   ├── routes/   auth, employees, payroll
│   │   ├── services/ sifGenerator.js — génération Excel
│   │   └── middleware/auth.js (JWT)
│   └── package.json
└── frontend/         React + Vite
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   └── pages/    Login, Register, Employees, Generate, CompanySettings, History
    └── package.json
```

## Prérequis

- **Node.js 18+** (recommandé : 20 ou 22) — <https://nodejs.org>
- **npm** (livré avec Node.js)
- Système : Windows, macOS ou Linux

## Installation (première fois)

### 1. Backend

```bash
cd backend
cp .env.example .env       # sur Windows : copy .env.example .env
# Éditez .env si besoin (changez JWT_SECRET)
npm install
npm run init-db
```

### 2. Frontend

```bash
cd ../frontend
npm install
```

## Lancement

Dans deux terminaux séparés :

### Terminal 1 — backend

```bash
cd backend
npm start
# API sur http://localhost:4000
```

### Terminal 2 — frontend

```bash
cd frontend
npm run dev
# Interface sur http://localhost:5173
```

Ouvrez <http://localhost:5173> dans votre navigateur.

## Premier usage

1. **Créer un compte** (onglet « Créer un compte ») — renseignez :
   - Nom de l'entreprise
   - ID établissement (`employer_id`, ex : `0000002554476`)
   - Code routing de votre banque employeur (ex : `808610001`)
   - Email et mot de passe d'administration
2. **Ajouter des employés** (onglet Employés)
   - Manuellement via le formulaire, OU
   - Importez un CSV/Excel — modèle dans `examples/employees_sample.csv`
3. **Générer le fichier** (onglet Générer)
   - Choisissez la période (ex : 2026-03-01 → 2026-03-31)
   - Optionnellement ajustez les montants du mois (variable, congés)
   - Cliquez sur **Télécharger le fichier SIF**
4. **Importer dans votre banque** — utilisez le fichier `.xlsx` téléchargé

## Format de la ligne SCR (contrôle)

La ligne SCR est générée automatiquement. Les champs par défaut sont :

| Colonne | Contenu | Défaut |
|---------|---------|--------|
| A (Type) | `SCR` | — |
| B (Employee_ID) | ID établissement | depuis l'entreprise |
| C (Routing_Code) | Code routing employeur | depuis l'entreprise |
| D (Employee_IBAN) | Date création fichier | date du jour (YYYY-MM-DD) |
| E (PayStart_Date) | Heure création (HHMM) | heure courante |
| F (PayEnd_Date) | Mois du salaire (MMYYYY) | mois de la période |
| G (Days_In_Period) | Nombre d'employés | calculé |
| H (Fixed_Income) | Total des salaires | calculé (fixe + variable) |
| I (Variable_Income) | Devise | `AED` |

Les champs D, E, F peuvent être ajustés manuellement dans la page Générer si la banque exige une autre valeur.

## Format d'import CSV

Exemple (`employees_sample.csv`) :

```csv
employee_id,full_name,routing_code,iban,fixed_income,variable_income
10020109625839,Safwan,202620103,AE220260001015825570901,17000,0
10020109625840,Ahmed,202620103,AE220260001015825570902,15000,500
```

Champs obligatoires : `employee_id`, `routing_code`, `iban`. Les autres sont optionnels.

## Sécurité

- Les mots de passe sont hashés via **bcrypt** (10 rounds)
- Authentification **JWT** (expiration 7 jours)
- **Isolation stricte** : chaque requête ne voit que les employés de l'entreprise connectée
- Modifiez impérativement le `JWT_SECRET` dans `.env` avant toute mise en production

## Déploiement (production)

- Backend : hébergez sur un service Node.js (Railway, Render, Fly.io, serveur VPS)
- Frontend : `npm run build` puis servez `dist/` via Nginx, Vercel, Netlify, etc.
- Configurez `CORS_ORIGIN` dans `.env` pour autoriser votre domaine frontend
- Utilisez HTTPS en production
- Faites des sauvegardes régulières de `backend/data/wps.db`

## Dépannage

**« Could not locate the bindings file » pour better-sqlite3**
→ Relancez `npm install` dans `backend/`. Si ça échoue, installez les outils de build :
- Windows : `npm install -g windows-build-tools`
- macOS : `xcode-select --install`
- Linux : `sudo apt install build-essential python3`

**Port 4000 ou 5173 déjà utilisé**
→ Modifiez `PORT` dans `backend/.env` et le proxy dans `frontend/vite.config.js`.

## Licence

Usage interne — Heurtier SAS.
