---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# OIBus Developer Handbook

Welcome to the OIBus developer community! This guide will help you get started with contributing to OIBus.

## 🚀 Getting Started

### Prerequisites

| Tool                      | Purpose                                       | Required?   | Installation                                                                            |
| ------------------------- | --------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Git                       | Version control                               | ✅          | [git-scm.com](https://git-scm.com/downloads)                                            |
| Node.js                   | JavaScript runtime (see `.nvmrc` for version) | ✅          | [nodejs.org](https://nodejs.org/) (or install via `nvm`)                                |
| nvm                       | Node version manager                          | Recommended | [nvm install guide](https://github.com/nvm-sh/nvm)                                      |
| Angular CLI               | Frontend tooling                              | Recommended | `npm install -g @angular/cli`                                                           |
| VS Code or IntelliJ       | Code editor                                   | Recommended | [VS Code](https://code.visualstudio.com/) · [IntelliJ](https://www.jetbrains.com/idea/) |
| DBeaver or SQLite browser | Database inspection                           | Optional    | [DBeaver](https://dbeaver.io/) · [SQLite browser](https://sqlitebrowser.org/)           |

## 📥 Setting Up Your Development Environment

### 1. Get the Source Code

The OIBus source lives on GitHub at
[github.com/OptimistikSAS/OIBus](https://github.com/OptimistikSAS/OIBus). You'll use **Git** to clone it
locally and to share your work back via pull requests.

:::tip New to Git?
Run [GitHub's "Set up Git"](https://docs.github.com/en/get-started/getting-started-with-git/set-up-git)
once to install and configure it. Add an
[SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) to use the
`git@github.com:…` URLs below — or swap them for `https://github.com/…` and Git will prompt for a token
instead. The [Pro Git book](https://git-scm.com/book/en/v2) (free online) is the reference for everything
else.
:::

Once Git is installed and authenticated, choose one of these options:

**Option A: For Contributors (Recommended)**

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

**Option B: For Evaluation Only**

```bash
git clone git@github.com:OptimistikSAS/OIBus.git
cd OIBus
```

#### Day-to-day Git workflow

A typical contribution looks like:

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

If `main` has moved while you were working, rebase to keep history linear:

```bash
git fetch upstream
git rebase upstream/main
# resolve any conflicts, then:
git push --force-with-lease
```

Use `--force-with-lease` (not plain `--force`) — it refuses to overwrite remote commits you don't know
about, so you can't accidentally clobber a teammate's review fixup.

### 2. Install Dependencies

```bash
# Install Node.js version specified in .nvmrc
nvm install
nvm use
```

### 3. Set Up the Backend

```bash
cd backend
npm install
npm start  # Starts on http://localhost:2223
```

### 4. Set Up the Frontend

```bash
cd frontend
npm install
npm start  # Builds and watches for changes
```

:::caution Frontend Note
The frontend is served by the backend. While `npm start` watches for changes, you'll need to **manually refresh** your browser to see updates.
:::

### 5. Set Up Documentation

```bash
cd documentation
npm install
npm start  # Starts on http://localhost:3000
```

### 6. (Optional) Set Up the Launcher

Skip this unless you're working on the supervisor / auto-update path. The launcher is a standalone Node
package with its own dependencies, its own test runner (`node --test`, not Jest), and a separate Node
version pin (`node >= 24`, see `launcher/package.json`).

```bash
cd launcher
npm install
npm test           # runs node --test on src/**/*.spec.ts
npm run lint
# Bundle a binary for your platform (e.g. macOS arm64):
npm run build:macos-arm64
```

The bundled binary lands in `build/bin/<platform>/oibus-launcher` and that's what ships in the platform
installers — it's responsible for starting the OIBus runtime binary as a child process.

### 7. Verify Your Setup

- Backend: [http://localhost:2223](http://localhost:2223)
- Documentation: [http://localhost:3000](http://localhost:3000)

## 🛠 Development Workflow

### Project Structure

```
OIBus/
├── backend/          # Backend server (Node.js + TypeScript)
├── frontend/         # Frontend application (Angular)
├── launcher/         # Process supervisor + auto-update (bundled to native binaries)
├── documentation/    # Project documentation (Docusaurus)
├── docker/           # docker-compose stack for simulating sources / destinations
└── data-folder/      # Runtime data (created automatically)
```

The **launcher** is a small TypeScript program that supervises the OIBus binary in production: it handles
the update/rollback cycle, manages PID files, and is the entry point shipped in the platform installers.
It's bundled via [@yao-pkg/pkg](https://github.com/yao-pkg/pkg) into per-platform executables
(`win-x64`, `macos-x64`, `macos-arm64`, `linux-x64`, `linux-arm64`). You only need to touch it when you're
changing the supervisor itself, the on-disk layout it manages, or the update flow.

### Quick Test Setup

To verify everything works:

1. Create a **FolderScanner** South connector (reads files from a directory)
2. Create a **Console** North connector (outputs to console)
3. Configure them to work together

## 🔧 Development Guidelines

### Branch Naming

```
<type>/<descriptive-name>#<issue-number>
```

Examples:

- `feature/add-new-connector#1234`
- `fix/folder-scanner-bug#5678`
- `docs/update-readme#9101`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body — explain the *why*, not the *what*]

[optional footer — e.g. "Closes #1234", "BREAKING CHANGE: ..."]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`.

Common scopes correspond to top-level concerns: `south`, `north`, `engine`, `cache`, `transformer`,
`oianalytics`, `logger`, `web-server`, `migration`, `frontend`, `launcher`, `docs`. Use the most specific
one that fits; omit the scope entirely if the change is cross-cutting.

#### Examples

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

The squash-merge into `main` uses the PR title as the commit message, so make sure the **title** follows
this format — the individual commits on your branch can be looser.

### Testing Requirements

All changes must include tests:

- **Backend**: [Jest](https://jestjs.io/)
- **Frontend**: [Jasmine](https://jasmine.github.io/)
- **Launcher**: Node's built-in [`node --test`](https://nodejs.org/api/test.html) (no Jest)

Run tests with:

```bash
# Backend tests
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

## 📤 Submitting Contributions

### Before You Start

1. **Check existing issues** for similar work
2. **Create a feature issue** if adding new functionality
3. **Discuss your approach** with maintainers before coding

### Pull Request Process

1. Create a branch from `main` with [proper naming](#branch-naming).
2. Make your changes and commit with [clear messages](#commit-messages).
3. Run the checks locally — before pushing, confirm each box:
   - [ ] Code follows the project style (`npm run lint` in every package you touched).
   - [ ] All tests pass (`npm test`).
   - [ ] New features include tests; existing coverage is maintained.
   - [ ] Documentation updated if the change is user-visible or alters the developer workflow.
   - [ ] Changes are backward compatible (or the breaking change is called out in the PR title with `!`
         and in the body with a `BREAKING CHANGE:` footer).
4. Push to your fork and open a Pull Request to `OptimistikSAS/OIBus:main`.
5. Wait for code review and address feedback. Use `--force-with-lease` for any rebase pushes (see the
   [Git workflow](#1-get-the-source-code)).

## 🤝 Community Guidelines

### How to Contribute

1. **Start small**: Fix typos, improve docs, or tackle "good first issue" labels
2. **Ask questions**: Use GitHub discussions or issues
3. **Be patient**: We'll review your PR as soon as possible
4. **Stay engaged**: Be responsive to feedback

### Code of Conduct

We follow a [Code of Conduct](https://github.com/OptimistikSAS/OIBus/blob/main/DEVELOPER-GUIDELINES.md) to ensure a welcoming community.

## 📚 Learning Resources

### Technologies Used

| Area          | Technology   | Learning Resources                                                          |
| ------------- | ------------ | --------------------------------------------------------------------------- |
| Backend       | Node.js      | [Node.js Docs](https://nodejs.org/en/docs/)                                 |
| Frontend      | Angular      | [Angular Docs](https://angular.io/docs)                                     |
| Documentation | Docusaurus   | [Docusaurus Docs](https://docusaurus.io/)                                   |
| Testing       | Jest/Jasmine | [Jest Docs](https://jestjs.io/), [Jasmine Docs](https://jasmine.github.io/) |

### Recommended Reading

Deep-links into the official documentation of the libraries OIBus relies on most. Each one targets the
section that's directly useful when working on the codebase — not generic landing pages.

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) — the backend and frontend
  are both strict TypeScript; the Handbook's chapters on generics and discriminated unions are particularly
  relevant to the manifest / settings layer.
- [Angular guide](https://angular.dev/overview) — the frontend is built with Angular, including reactive
  forms (used to render manifests) and standalone components.
- [Node.js `node:stream` module](https://nodejs.org/api/stream.html) — the cache pipeline, transformers,
  and North `handleContent` work with streams; understanding backpressure and `pipeline()` matters.
- [Pino logger](https://getpino.io/) — every connector uses `this.logger`; the log-levels and
  child-logger patterns inform the conventions documented in
  [the connector class guide](./create-connector/class.md).
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) — the local
  cache (entities, metrics, logs, south-cache) is all better-sqlite3; prepared statements and transactions
  show up in every repository.
- [Knex migrations](https://knexjs.org/guide/migrations.html) — schema changes go through Knex; the
  migration files under `backend/src/migration/` follow this guide's conventions.
- [Jest](https://jestjs.io/docs/getting-started) — backend test framework, with particular focus on the
  [mocking](https://jestjs.io/docs/mock-functions) and [fake timers](https://jestjs.io/docs/timer-mocks)
  pages (both are used heavily in connector specs).
- [Docusaurus](https://docusaurus.io/docs) — for editing the documentation site itself.
- [Conventional Commits](https://www.conventionalcommits.org/) and
  [Semantic Versioning](https://semver.org/) — the commit-message format and release versioning
  conventions OIBus uses.

## 🎯 First Contributions

A few concrete starting points, ranked from lowest to highest investment. Pick whichever matches your
available time and familiarity with the stack.

### Documentation fixes

The fastest way to make your first PR land. Most pages live in `documentation/docs/` as Markdown / MDX —
typos, missing examples, outdated screenshots, and broken links are all valuable contributions. Run
`npm start` in `documentation/` to preview your changes locally.

Search [open documentation issues](https://github.com/OptimistikSAS/OIBus/labels/documentation), or just
fix something you noticed while reading these docs.

### Bug fixes

Look for issues tagged [`good first issue`](https://github.com/OptimistikSAS/OIBus/labels/good%20first%20issue)
— those are intentionally scoped so a new contributor can get to a working PR without needing a guided
tour of the codebase. If nothing matches your interest, scan the broader
[`bug` label](https://github.com/OptimistikSAS/OIBus/labels/bug) and pick a reproducible one. **Comment on
the issue before you start** so we can confirm nobody else is already on it and answer any preliminary
questions.

### Improve an existing connector

OIBus's South / North connectors are a great way to learn the codebase incrementally: each one is a small
self-contained class with a manifest and a spec, and they all follow the same pattern. Useful entry-level
work includes adding a settings option, improving error messages, or extending a `testConnection()` to
surface more diagnostics.

Start from `backend/src/south/south-<type>/` (or the equivalent North folder) and skim the corresponding
`.spec.ts` to see what's covered. Every PR should keep coverage at 100%.

### Add a new connector

For larger contributions, see the dedicated guide:
[Create a new OIBus connector](./create-connector/presentation.md). It walks through the file layout, the
four registration steps (type list, factory, type-generator, translations), the manifest format, and the
connector class API with full working examples.

### Benchmark the product

We welcome contributions that _measure_ OIBus's behaviour under realistic load and either propose a
targeted fix or simply document the finding. The repository ships a `docker-compose.yml` with simulated
sources and destinations specifically to make this kind of work approachable:

| Container                    | Purpose                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `opcua-server`               | Microsoft `opc-plc` server with configurable nodes — drives South-OPC UA load tests |
| `modbus-server`              | `oitc/modbus-server` — drives South-Modbus tests                                    |
| `mqtt-broker`                | Eclipse Mosquitto + a Python simulator that publishes values                        |
| `postgres`                   | Postgres database for South-PostgreSQL                                              |
| `ftp-server` / `sftp-server` | File-based sources                                                                  |
| `nginx`                      | Front proxy when testing the full deployment                                        |

Bring the stack up with `docker compose up -d` (some services live behind the `testing` / `oibus` Docker
Compose profiles — see the file for details). Then configure OIBus to point at the simulators and observe
behaviour as you ramp item counts, scan-mode frequency, or batch sizes.

**What's most useful to measure:**

- **Throughput under sustained load** — items/sec a South can ingest without queue backpressure; files/sec
  a North can deliver without piling up in the error folder.
- **Memory growth** — heap and RSS over a multi-hour run, looking for slow leaks in transformer or cache
  paths.
- **Boot time** — startup time after a few million logs / a backlogged cache. Improvements here are
  visible to every operator on every restart.
- **DB hot paths** — the SQLite caches (`south-cache.repository`, `log.repository`, the metrics
  repositories) all sit on writer threads; a profiler trace pointing at one specific query is gold.

When proposing a fix, include a before/after measurement in the PR description (even a rough one — a
`process.hrtime.bigint()`-wrapped microbenchmark or a screenshot of a running OIBus is better than no
number at all). That makes review faster and gives the team a baseline for regression checks later.

---

**Ready to contribute?** We're excited to have you! 🎉
