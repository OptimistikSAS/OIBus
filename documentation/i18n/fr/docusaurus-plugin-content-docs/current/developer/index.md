---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# Guide du développeur OIBus

Bienvenue dans la communauté des développeurs OIBus ! Ce guide vous aidera à démarrer avec la contribution à OIBus.

## 🚀 Pour commencer {#-getting-started}

### Prérequis {#prerequisites}

| Outil                     | Objectif                                       | Requis ?    | Installation                                                                            |
| ------------------------- | --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Git                       | Contrôle de version                            | ✅          | [git-scm.com](https://git-scm.com/downloads)                                            |
| Node.js                   | Environnement d'exécution JavaScript (voir `.nvmrc` pour la version) | ✅          | [nodejs.org](https://nodejs.org/) (ou installer via `nvm`)                              |
| nvm                       | Gestionnaire de versions Node                  | Recommandé  | [guide d'installation nvm](https://github.com/nvm-sh/nvm)                               |
| VS Code ou IntelliJ       | Éditeur de code                                | Recommandé  | [VS Code](https://code.visualstudio.com/) · [IntelliJ](https://www.jetbrains.com/idea/) |
| DBeaver ou navigateur SQLite | Inspection de la base de données            | Optionnel   | [DBeaver](https://dbeaver.io/) · [SQLite browser](https://sqlitebrowser.org/)           |

## 📥 Configurer votre environnement de développement {#-setting-up-your-development-environment}

### 1. Récupérer le code source {#1-get-the-source-code}

Le code source d'OIBus se trouve sur GitHub à l'adresse
[github.com/OptimistikSAS/OIBus](https://github.com/OptimistikSAS/OIBus). Vous utiliserez **Git** pour le
cloner localement et pour partager votre travail via des pull requests.

:::tip Nouveau avec Git ?
Exécutez une fois [le guide « Set up Git » de GitHub](https://docs.github.com/en/get-started/getting-started-with-git/set-up-git)
pour l'installer et le configurer. Ajoutez une
[clé SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) pour utiliser les URL
`git@github.com:…` ci-dessous — ou remplacez-les par `https://github.com/…` et Git vous demandera un jeton
à la place. Le [livre Pro Git](https://git-scm.com/book/en/v2) (gratuit en ligne) est la référence pour
tout le reste.
:::

Une fois Git installé et authentifié, choisissez l'une de ces options :

**Option A : Pour les contributeurs (recommandé)**

```bash
# 1. Fork the repository on GitHub (use the "Fork" button on the repo page)
# 2. Clone YOUR fork locally:
git clone git@github.com:<your-username>/OIBus.git
cd OIBus
# 3. Register the OptimistikSAS repo as a second remote called "upstream"
#    so you can later pull in changes from the main project:
git remote add upstream git@github.com:OptimistikSAS/OIBus.git
# 4. Sanity-check both remotes are registered:
git remote -v
```

**Option B : Pour évaluation uniquement**

```bash
git clone git@github.com:OptimistikSAS/OIBus.git
cd OIBus
```

#### Flux de travail Git au quotidien {#day-to-day-git-workflow}

Une contribution typique ressemble à ceci :

```bash
# Start from an up-to-date main
git checkout main
git pull upstream main

# Branch for your change — see "Branch Naming" further down
git checkout -b feat/my-new-feature#1234

# Edit files, then stage and commit
git add <files>
git commit -m "feat(south): describe what you did"

# Push to YOUR fork (origin)
git push -u origin feat/my-new-feature#1234

# Open a Pull Request from your fork's branch into OptimistikSAS/OIBus:main
```

Si `main` a évolué pendant que vous travailliez, effectuez un rebase pour garder un historique linéaire :

```bash
git fetch upstream
git rebase upstream/main
# resolve any conflicts, then:
git push --force-with-lease
```

Utilisez `--force-with-lease` (et non `--force` seul) — cela refuse d'écraser des commits distants que vous
ne connaissez pas, afin que vous ne puissiez pas accidentellement effacer le correctif de revue d'un
coéquipier.

### 2. Installer les dépendances {#2-install-dependencies}

```bash
# Install Node.js version specified in .nvmrc
nvm install
nvm use
```

### 3. Configurer le backend {#3-set-up-the-backend}

```bash
cd backend
npm install
npm start  # Starts on http://localhost:2223
```

### 4. Configurer le frontend {#4-set-up-the-frontend}

```bash
cd frontend
npm install
npm start  # Builds and watches for changes
```

:::caution Remarque sur le frontend
Le frontend est servi par le backend. Bien que `npm start` surveille les changements, vous devrez
**actualiser manuellement** votre navigateur pour voir les mises à jour.
:::

### 5. Configurer la documentation {#5-set-up-documentation}

```bash
cd documentation
npm install
npm start  # Starts on http://localhost:3000
```

### 6. (Optionnel) Configurer le Launcher {#6-optional-set-up-the-launcher}

Passez cette étape à moins que vous ne travailliez sur le superviseur / le chemin de mise à jour
automatique. Le launcher est un package Node autonome avec ses propres dépendances et une version Node
distincte (`node >= 24`, voir `launcher/package.json`).

```bash
cd launcher
npm install
npm test           # runs node --test on src/**/*.spec.ts
npm run lint
# Bundle a binary for your platform (e.g. macOS arm64):
npm run build:macos-arm64
```

Le binaire assemblé atterrit dans `build/bin/<platform>/oibus-launcher` et c'est ce qui est livré dans les
installateurs de la plateforme — il est responsable du démarrage du binaire d'exécution OIBus en tant que
processus enfant.

### 7. Vérifier votre configuration {#7-verify-your-setup}

- Backend : [http://localhost:2223](http://localhost:2223)
- Documentation : [http://localhost:3000](http://localhost:3000)

## 🛠 Flux de travail de développement {#-development-workflow}

### Structure du projet {#project-structure}

```
OIBus/
├── backend/          # Backend server (Node.js + TypeScript)
├── frontend/         # Frontend application (Angular)
├── launcher/         # Process supervisor + auto-update (bundled to native binaries)
├── documentation/    # Project documentation (Docusaurus)
├── docker/           # docker-compose stack for simulating sources / destinations
└── data-folder/      # Runtime data (created automatically)
```

Le **launcher** est un petit programme TypeScript qui supervise le binaire OIBus en production : il gère le
cycle de mise à jour/retour arrière, gère les fichiers PID, et constitue le point d'entrée livré dans les
installateurs de plateforme. Il est assemblé via [@yao-pkg/pkg](https://github.com/yao-pkg/pkg) en
exécutables par plateforme (`win-x64`, `macos-x64`, `macos-arm64`, `linux-x64`, `linux-arm64`). Vous n'avez
besoin d'y toucher que lorsque vous modifiez le superviseur lui-même, la structure sur disque qu'il gère, ou
le flux de mise à jour.

### Configuration de test rapide {#quick-test-setup}

Pour vérifier que tout fonctionne :

1. Créez un connecteur South **FolderScanner** (lit les fichiers d'un répertoire)
2. Créez un connecteur North **Console** (sortie vers la console)
3. Configurez-les pour qu'ils fonctionnent ensemble

## 🔧 Directives de développement {#-development-guidelines}

### Nommage des branches {#branch-naming}

```
<type>/<descriptive-name>#<issue-number>
```

Exemples :

- `feature/add-new-connector#1234`
- `fix/folder-scanner-bug#5678`
- `docs/update-readme#9101`

### Messages de commit {#commit-messages}

Suivez [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<scope>): <description>

[optional body — explain the *why*, not the *what*]

[optional footer — e.g. "Closes #1234", "BREAKING CHANGE: ..."]
```

Types courants : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`.

Les scopes courants correspondent aux préoccupations de haut niveau : `south`, `north`, `engine`, `cache`,
`transformer`, `oianalytics`, `logger`, `web-server`, `migration`, `frontend`, `launcher`, `docs`. Utilisez
le plus spécifique qui convient ; omettez complètement le scope si le changement est transversal.

#### Exemples {#examples}

```text title="Feature commit"
feat(south): add subscription support to south-rest

Extends the REST connector to maintain a long-lived SSE connection and push
events to the engine via addContent. Falls back to polling if the server
responds with anything other than text/event-stream on the subscribe call.

Closes #4231
```

```text title="Bug fix"
fix(cache): write the correct chunk content when maxNumberOfElements > 0

cacheWithoutTransform was JSON.stringify-ing the full content array for each
chunk file instead of the chunk itself, duplicating every payload.
```

```text title="Performance"
perf(north): fan out cacheContent in parallel across enabled Norths

Replaces the sequential await loop in data-stream-engine.addContent with
Promise.all + per-North .catch. A slow North no longer blocks healthy ones.
```

```text title="Refactor"
refactor(south-opcua): cache item-per-node lookup in HistoryRead loop

Replaces the O(N²) Array.find per response result with an item bundled into
the nodesToRead array, accessed by index.
```

```text title="Docs / chore"
docs(create-connector): rewrite outdated class and manifest pages
chore(deps): bump better-sqlite3 to 12.9.0
```

```text title="Breaking change"
feat(north)!: replace handleValues/handleFile with handleContent

BREAKING CHANGE: North subclasses must now implement a single
handleContent(fileStream, metadata) method and declare supportedTypes()
instead of canHandleValues / canHandleFiles flags.
```

Le squash-merge vers `main` utilise le titre de la PR comme message de commit, alors assurez-vous que le
**titre** suit ce format — les commits individuels sur votre branche peuvent être plus libres.

### Exigences en matière de tests {#testing-requirements}

Tous les changements doivent inclure des tests :

- **Backend** : le runner intégré de Node [`node:test`](https://nodejs.org/api/test.html), avec le
  TypeScript transpilé à la volée via [`tsx`](https://tsx.is/). La couverture est collectée automatiquement
  lors de l'exécution de `npm test` (voir `testRunner` dans `backend/package.json` pour la liste
  d'exclusion).
- **Frontend** : [Jasmine](https://jasmine.github.io/) via le harnais de test Angular.
- **Launcher** : le même runner `node:test` que le backend.

Exécutez les tests avec :

```bash
# Backend — runs all specs with coverage
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Launcher tests (only if you touched launcher/)
cd launcher
npm test

# Linting (run in each package you touched)
npm run lint
```

## 📤 Soumettre des contributions {#-submitting-contributions}

### Avant de commencer {#before-you-start}

1. **Vérifiez les issues existantes** pour un travail similaire
2. **Créez une issue de fonctionnalité** si vous ajoutez une nouvelle fonctionnalité
3. **Discutez de votre approche** avec les mainteneurs avant de coder

### Processus de pull request {#pull-request-process}

1. Créez une branche depuis `main` avec un [nommage approprié](#branch-naming).
2. Effectuez vos modifications et validez-les avec des [messages clairs](#commit-messages).
3. Exécutez les vérifications localement — avant de pousser, confirmez chaque point :
   - [ ] Le code respecte le style du projet (`npm run lint` dans chaque package touché).
   - [ ] Tous les tests passent (`npm test`).
   - [ ] Les nouvelles fonctionnalités incluent des tests ; la couverture existante est maintenue.
   - [ ] La documentation est mise à jour si le changement est visible pour l'utilisateur ou modifie le
         flux de travail du développeur.
   - [ ] Les changements sont rétrocompatibles (ou le changement cassant est signalé dans le titre de la PR
         avec `!` et dans le corps avec un footer `BREAKING CHANGE:`).
4. Poussez vers votre fork et ouvrez une pull request vers `OptimistikSAS/OIBus:main`.
5. Attendez la revue de code et traitez les retours. Utilisez `--force-with-lease` pour tout push de rebase
   (voir le [flux de travail Git](#1-get-the-source-code)).

## 🤝 Directives communautaires {#-community-guidelines}

### Comment contribuer {#how-to-contribute}

1. **Commencez petit** : corrigez des fautes de frappe, améliorez la documentation, ou attaquez les étiquettes
   « good first issue »
2. **Posez des questions** : utilisez les discussions ou les issues GitHub
3. **Soyez patient** : nous relirons votre PR dès que possible
4. **Restez engagé** : soyez réactif aux retours

### Code de conduite {#code-of-conduct}

Nous suivons un [Code de conduite](https://github.com/OptimistikSAS/OIBus/blob/main/DEVELOPER-GUIDELINES.md)
pour garantir une communauté accueillante.

## 📚 Ressources d'apprentissage {#-learning-resources}

### Technologies utilisées {#technologies-used}

| Domaine       | Technologie          | Ressources d'apprentissage                                                                     |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| Backend       | Node.js             | [Documentation Node.js](https://nodejs.org/en/docs/)                                            |
| Frontend      | Angular             | [Documentation Angular](https://angular.io/docs)                                                |
| Documentation | Docusaurus          | [Documentation Docusaurus](https://docusaurus.io/)                                              |
| Tests         | node:test / Jasmine | [Documentation node:test](https://nodejs.org/api/test.html), [Documentation Jasmine](https://jasmine.github.io/) |

### Lectures recommandées {#recommended-reading}

Liens profonds vers la documentation officielle des bibliothèques dont dépend le plus OIBus. Chacun cible
la section directement utile lorsque l'on travaille sur la base de code — pas des pages d'accueil
génériques.

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) — le backend et le
  frontend sont tous deux en TypeScript strict ; les chapitres du Handbook sur les génériques et les unions
  discriminées sont particulièrement pertinents pour la couche manifest / settings.
- [Guide Angular](https://angular.dev/overview) — le frontend est construit avec Angular, y compris les
  formulaires réactifs (utilisés pour rendre les manifests) et les composants autonomes.
- [Module Node.js `node:stream`](https://nodejs.org/api/stream.html) — le pipeline de cache, les
  transformateurs, et `handleContent` du North fonctionnent avec des flux ; comprendre la contre-pression
  et `pipeline()` est important.
- [Logger Pino](https://getpino.io/) — chaque connecteur utilise `this.logger` ; les niveaux de log et les
  modèles de logger enfant informent les conventions documentées dans
  [le guide de la classe connecteur](./create-connector/class.md).
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) — le cache local
  (entités, métriques, journaux, cache south) est entièrement en better-sqlite3 ; les instructions
  préparées et les transactions apparaissent dans chaque repository.
- [Migrations Knex](https://knexjs.org/guide/migrations.html) — les changements de schéma passent par
  Knex ; les fichiers de migration sous `backend/src/migration/` suivent les conventions de ce guide.
- [Node.js `node:test`](https://nodejs.org/api/test.html) — le runner de tests utilisé à la fois par le
  backend et le launcher. Sections clés : [mocking](https://nodejs.org/api/test.html#mocking),
  [minuteries simulées](https://nodejs.org/api/test.html#class-mocktimers), et
  [couverture](https://nodejs.org/api/test.html#collecting-code-coverage) (les deux sont largement
  utilisées dans les spécifications de connecteurs).
- [Docusaurus](https://docusaurus.io/docs) — pour éditer le site de documentation lui-même.
- [Conventional Commits](https://www.conventionalcommits.org/) et
  [Semantic Versioning](https://semver.org/) — le format des messages de commit et les conventions de
  versionnement de release qu'OIBus utilise.

## 🎯 Premières contributions {#-first-contributions}

Quelques points de départ concrets, classés du moindre au plus grand investissement. Choisissez celui qui
correspond à votre temps disponible et à votre familiarité avec la pile technique.

### Corrections de documentation {#documentation-fixes}

Le moyen le plus rapide de faire aboutir votre première PR. La plupart des pages se trouvent dans
`documentation/docs/` en Markdown / MDX — les fautes de frappe, les exemples manquants, les captures
d'écran obsolètes, et les liens cassés sont toutes des contributions précieuses. Exécutez `npm start` dans
`documentation/` pour prévisualiser vos changements localement.

Recherchez les [issues de documentation ouvertes](https://github.com/OptimistikSAS/OIBus/labels/documentation),
ou corrigez simplement quelque chose que vous avez remarqué en lisant cette documentation.

### Corrections de bugs {#bug-fixes}

Recherchez les issues étiquetées [`good first issue`](https://github.com/OptimistikSAS/OIBus/labels/good%20first%20issue)
— celles-ci sont intentionnellement délimitées pour qu'un nouveau contributeur puisse aboutir à une PR
fonctionnelle sans avoir besoin d'une visite guidée de la base de code. Si rien ne correspond à votre
intérêt, parcourez l'étiquette [`bug`](https://github.com/OptimistikSAS/OIBus/labels/bug) plus large et
choisissez-en une reproductible. **Commentez l'issue avant de commencer** afin que nous puissions confirmer
que personne d'autre n'y travaille déjà et répondre à toute question préliminaire.

### Améliorer un connecteur existant {#improve-an-existing-connector}

Les connecteurs South / North d'OIBus sont un excellent moyen d'apprendre la base de code progressivement :
chacun est une petite classe autonome avec un manifest et une spécification, et ils suivent tous le même
modèle. Un travail utile pour un débutant inclut l'ajout d'une option de configuration, l'amélioration des
messages d'erreur, ou l'extension d'un `testConnection()` pour exposer davantage de diagnostics.

Partez de `backend/src/south/south-<type>/` (ou du dossier North équivalent) et parcourez le `.spec.ts`
correspondant pour voir ce qui est couvert. Chaque PR doit maintenir la couverture à 100 %.

### Ajouter un nouveau connecteur {#add-a-new-connector}

Pour les contributions plus importantes, consultez le guide dédié :
[Créer un nouveau connecteur OIBus](./create-connector/presentation.md). Il détaille la structure des
fichiers, les quatre étapes d'enregistrement (liste des types, factory, générateur de types, traductions),
le format du manifest, et l'API de la classe connecteur avec des exemples complets fonctionnels.

### Évaluer les performances du produit {#benchmark-the-product}

Nous accueillons les contributions qui _mesurent_ le comportement d'OIBus sous une charge réaliste et
proposent soit un correctif ciblé, soit documentent simplement le constat. Le dépôt fournit un
`docker-compose.yml` avec des sources et destinations simulées spécifiquement pour rendre ce genre de
travail accessible :

| Conteneur                    | Profil      | Objectif                                                                            |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `opcua-server`                | _(par défaut)_ | `opc-plc` de Microsoft — serveur OPC UA avec 8 nœuds configurables et prise en charge de l'historien |
| `modbus-server`                | _(par défaut)_ | `oitc/modbus-server` — serveur Modbus TCP                                            |
| `simulator`                   | _(par défaut)_ | Script Python écrivant des valeurs sinusoïdales sur Modbus et MQTT                   |
| `mqtt-broker`                  | _(par défaut)_ | Broker Eclipse Mosquitto (authentifié, WebSocket sur le port 9001)                   |
| `postgres`                    | _(par défaut)_ | PostgreSQL pour South-PostgreSQL                                                     |
| `ftp-server` / `sftp-server`   | `testing`   | Sources basées sur des fichiers                                                      |
| `oibus` / `nginx`              | `oibus`     | Environnement d'exécution OIBus complet + reverse proxy pour les tests de bout en bout |

Démarrez la pile avec `docker compose up -d` (certains services se trouvent derrière les profils Docker
Compose `testing` / `oibus` — voir le fichier pour plus de détails). Configurez ensuite OIBus pour qu'il
pointe vers les simulateurs et observez le comportement à mesure que vous augmentez le nombre d'éléments,
la fréquence des modes de scan, ou la taille des lots.

Tous les détails sur chaque service, son image, les signaux simulés, et les options de configuration se
trouvent dans la page [Pile de test locale](./local-test-stack.md).

**Ce qu'il est le plus utile de mesurer :**

- **Débit sous charge soutenue** — éléments/sec qu'un South peut ingérer sans contre-pression de file
  d'attente ; fichiers/sec qu'un North peut livrer sans s'accumuler dans le dossier d'erreur.
- **Croissance de la mémoire** — heap et RSS sur une exécution de plusieurs heures, à la recherche de
  fuites lentes dans les chemins de transformateur ou de cache.
- **Temps de démarrage** — temps de démarrage après quelques millions de journaux / un cache en retard.
  Les améliorations à ce niveau sont visibles par chaque opérateur à chaque redémarrage.
- **Chemins critiques de la base de données** — les caches SQLite (`south-cache.repository`,
  `log.repository`, les repositories de métriques) reposent tous sur des threads d'écriture ; une trace de
  profileur pointant vers une requête spécifique est précieuse.

Lorsque vous proposez un correctif, incluez une mesure avant/après dans la description de la PR (même
approximative — un microbenchmark enveloppé dans `process.hrtime.bigint()` ou une capture d'écran d'un
OIBus en cours d'exécution vaut mieux que pas de chiffre du tout). Cela accélère la revue et donne à
l'équipe une base de référence pour les vérifications de régression ultérieures.

---

**Prêt à contribuer ?** Nous sommes ravis de vous avoir parmi nous ! 🎉
