# WPS SIF — Générateur de fichier de paie (UAE)

Application web **full-stack** pour générer des fichiers Excel SIF (Salary Information File) au format UAE WPS (Wages Protection System), à importer ensuite dans l'application bancaire pour effectuer les virements de salaires aux employés.

## Fonctionnalités

- **Multi-entreprise (multi-tenant)** — chaque société gère ses propres employés, isolée des autres
- **Multilingue** : Français / English / العربية (avec support RTL complet pour l'arabe)
  - Détection automatique de la langue du navigateur au premier chargement
  - Sélecteur de langue accessible depuis la barre de navigation et les pages de connexion
- **Authentification** par email/mot de passe (JWT)
- **4 rôles** : `admin`, `hr`, `manager`, `employee` — chaque rôle voit/fait ce qui le concerne
- **Gestion des employés** — ajout, modification, suppression, activation/désactivation
  - Champs : ID, nom, email, poste, manager, IBAN/routing, salaires fixe & variable, solde de congés, actif
- **Import CSV/Excel en masse** — colonnes : `employee_id, full_name, routing_code, iban, fixed_income, variable_income`
- **Génération du fichier SIF (.xlsx)** au format exact du modèle fourni :
  - Feuille `SIF` avec en-têtes standards
  - Une ligne `EDR` par employé (Employee Detail Record)
  - Une ligne `SCR` de contrôle (Salary Control Record) avec totaux
  - Toutes les valeurs en **texte** pour préserver les zéros de tête et éviter les conversions bancaires
- **Ajustements mensuels** — modifier les montants d'un mois sans toucher la fiche employé
- **Historique** des fichiers générés

### Module RH

- **Dashboard par rôle** — compteurs et actions rapides adaptés (admin/hr voient toute la société, managers leurs subordonnés, collaborateurs uniquement leurs propres infos)
- **Gestion des congés** — demande, validation 1 niveau (manager direct ou RH/admin), solde annuel automatiquement décrémenté à l'approbation d'un congé annuel
- **Notes de frais** — saisie avec reçu (image/PDF), workflow pending → approved → paid, téléchargement du reçu
- **Documents collaborateurs** — upload de contrats, passeports, Emirates ID, visas, CVs, bulletins (stockage local sous `backend/uploads/{companyId}/`)
- **Gestion des utilisateurs** (admin uniquement) — création de comptes liés à une fiche employé, réinitialisation de mot de passe, activation/désactivation, changement de rôle
- **Mon espace** — chaque utilisateur peut consulter son profil, son solde de congés, et changer son mot de passe

## Architecture

```
wps-sif-app/
├── backend/          Node.js + Express + SQLite (better-sqlite3)
│   ├── src/
│   │   ├── server.js
│   │   ├── db/       Base de données SQLite (+ migrations idempotentes)
│   │   ├── routes/   auth, users, employees, payroll, leaves, expenses, documents, dashboard
│   │   ├── services/ sifGenerator.js, uploads.js (multer disque)
│   │   └── middleware/auth.js (JWT + requireRole + canAccessEmployee)
│   ├── uploads/      (créé à la volée) — reçus et documents collaborateurs
│   └── package.json
└── frontend/         React + Vite
    ├── src/
    │   ├── App.jsx   (navigation + routes conditionnelles par rôle)
    │   ├── api.js
    │   ├── i18n/     locales.js + I18nContext.jsx (FR/EN/AR)
    │   └── pages/    Login, Register, Dashboard, Leaves, Expenses, Documents,
    │                 Employees, Users, MySpace, Generate, CompanySettings, History
    └── package.json
```

## Rôles et permissions

| Rôle | Dashboard | Employés | Congés | Notes de frais | Documents | Fichier SIF | Utilisateurs |
|------|-----------|----------|--------|----------------|-----------|-------------|--------------|
| **admin** | Société complète | CRUD | Toutes + validation | Toutes + paie | Tous | Génère | CRUD |
| **hr** | Société complète | CRUD | Toutes + validation | Toutes + paie | Tous | Génère | — |
| **manager** | Son équipe | Lecture (équipe) | Équipe + ses propres + validation | Équipe + ses propres + validation | — | — | — |
| **employee** | Ses infos | Lui-même | Ses propres | Ses propres | Les siens (lecture) | — | — |

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
   - Email et mot de passe d'administration (ce compte aura le rôle `admin`)
2. **Ajouter des employés** (onglet Employés)
   - Manuellement via le formulaire (avec manager, poste, email…)
   - Ou importez un CSV/Excel — modèle dans `examples/employees_sample.csv`
3. **Créer les comptes des collaborateurs** (onglet Utilisateurs — admin uniquement)
   - Choisissez le rôle : `hr`, `manager` ou `employee`
   - Pour un manager ou un employé, liez-le à une fiche employé
4. **Les collaborateurs peuvent alors** :
   - Se connecter avec leur email/mot de passe
   - Voir leur dashboard, demander des congés, soumettre des notes de frais, consulter leurs documents
5. **Validation** — les managers valident les demandes de leur équipe, RH/admin peuvent valider pour tous
6. **Générer le fichier SIF** (admin/hr, onglet Générer)
   - Choisissez la période (ex : 2026-03-01 → 2026-03-31)
   - Optionnellement ajustez les montants du mois (variable, congés)
   - Cliquez sur **Télécharger le fichier SIF**
7. **Importer dans votre banque** — utilisez le fichier `.xlsx` téléchargé

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
- **Sauvegardez aussi `backend/uploads/`** — contient les reçus et documents collaborateurs (ne pas mettre dans git)
- Vous pouvez surcharger `UPLOADS_DIR` dans `.env` pour utiliser un stockage externe (NAS, volume monté, etc.)

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
