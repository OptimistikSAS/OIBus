# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is OIBus

OIBus is an open-source industrial data collection and forwarding agent. It runs as a self-contained binary on Windows/Linux/macOS and exposes a web UI for configuration. Data flows from **South connectors** (protocol adapters that collect data: OPC-UA, Modbus, MQTT, SQL databases, FTP, folder scanners, …) through an **Engine** that buffers and transforms it, then out via **North connectors** (sinks: OIAnalytics, REST, MQTT, Azure Blob, S3, file writer, …). A separate **Launcher** process wraps the main binary to handle upgrades and crash recovery.

All configuration is stored in SQLite databases in a configurable data folder (`oibus.db`, `crypto.db`, `logs.db`, `metrics.db`, `cache.db`).

---

## Repository layout

```
backend/    Node.js backend — engine, connectors, REST API, migrations
frontend/   Angular SPA — compiled into backend/dist/frontend/
launcher/   Minimal Node.js wrapper that spawns the backend process
documentation/  Docusaurus site
build/      Platform build scripts and Windows installer (Inno Setup)
```

Everything that ships runs on **Node v24 / npm v11** (enforced in `package.json` `engines`).

---

## Commands

All commands must be run from the relevant subdirectory (`backend/`, `frontend/`, or `launcher/`), not the repo root.

### Backend

```bash
# Run all unit tests
npm test

# Run a single spec file
node --import tsx --experimental-config-file=package.json --test src/path/to/file.spec.ts

# Lint
npm run lint
npm run lint:fix

# TypeScript compile (no output — type-check only via tsc --noEmit)
npm run build

# Generate OpenAPI spec from tsoa decorators (required after changing controllers)
npm run generate:openapi

# Start a local multi-service test stack (OPC-UA servers, MQTT broker, SQL DBs, FTP)
npm run docker:dev
```

### Frontend

```bash
# Run all tests (requires Chromium — install once with: npx playwright install chromium)
npm test

# Lint
npm run lint

# Production build (outputs to ../backend/dist/frontend)
npm run build

# Development watch mode
npm start
```

### Launcher

```bash
npm test      # same single-file pattern as backend
npm run lint
npm run build
```

### Documentation

```bash
npm start    # local dev server
npm run build
```

---

## Architecture

### Data flow

```
South connector(s)
  └─► Engine (DataStreamEngine / HistoryQuery)
        ├── Cache (per-north SQLite + files)
        ├── Transformers (JSON→CSV, time-values→MQTT, …)
        └─► North connector(s)
```

`DataStreamEngine` in `backend/src/engine/data-stream-engine.ts` is the central orchestrator. It starts/stops connectors, routes data from souths to norths based on subscription mappings, and drives caching. `HistoryQueryFactory` manages one-shot historical back-fill jobs (`backend/src/engine/history-query-factory.ts`).

### South connector pattern

Every south connector extends `SouthConnector` (`backend/src/south/south-connector.ts`). A connector implements one or more of three query interfaces declared in `south-interface.ts`:
- `SouthHistoryQuery` — time-range queries (SQL, OPC-UA HA, …)
- `SouthDirectQuery` — file-based or poll-based retrieval
- `SouthSubscription` — push-based (MQTT, OPC-UA DA subscriptions)

`SouthConnectorFactory` (`backend/src/south/south-connector-factory.ts`) instantiates connectors by type string.

### North connector pattern

Every north connector extends `NorthConnector` (`backend/src/north/north-connector.ts`). The base class owns the send/retry/archive/error cache. Subclasses implement `handleContent()`. `NorthConnectorFactory` does instantiation.

### Transformers

Transformers sit between the engine and north connectors. Standard transformers live in `backend/src/transformers/` (e.g. `time-values-to-csv`, `json-to-csv`). Custom transformers run inside `isolated-vm` sandboxes via `SandboxService`. Each transformer has a `manifest.ts` that declares its input/output types.

### Web server & API

The Express 5 server (`backend/src/web-server/`) uses **tsoa** for contract-first REST. Controllers in `web-server/controllers/` are decorated with tsoa annotations; `npm run generate:openapi` regenerates `routes.ts` and `swagger.json`. Do not hand-edit `routes.ts`.

### Database & migrations

Knex manages schema migrations. Entity migrations live under `backend/src/migration/entity-migrations/3/` grouped by minor version (e.g. `3.8/v3.8.0.ts`). Data-folder migrations (cache structure, file layout) live under `backend/src/migration/data-folder-migrations/`. South-cache migrations under `backend/src/migration/south-cache-migrations/`. The migration service runs all pending migrations at startup via `getMigrationDirs()` which collects leaf directories recursively.

When writing new migrations: use `knex.batchInsert(table, rows, 100)` instead of `knex(table).insert(largeArray)` to avoid SQLite's `SQLITE_LIMIT_COMPOUND_SELECT` limit (default 500).

### OIAnalytics registration

OIBus can register with an OIAnalytics cloud instance for remote management. The registration creates an RSA key pair; secrets are stripped before configuration is sent to OIAnalytics and only ever stored encrypted locally. Code lives in `backend/src/service/oia/`.

### Launcher

`launcher/src/launcher.ts` spawns the backend (`oibus` binary) as a child process. When the child stops, the launcher checks an `update/` folder for new binaries — if found, it performs an in-place upgrade; otherwise it restarts the existing binary. This is what enables remote upgrades triggered from OIAnalytics.

---

## Testing conventions

### Backend (Node test runner)

Tests use Node's native `node:test` module with `assert/strict`. Mocking uses `mock.fn()`, `mock.method()`, `mock.module()`. There is no Jest/Sinon. Key helpers are in `backend/src/tests/utils/test-utils.ts` (`mockModule`, `reloadModule`, `seq`).

Because tsx compiles ES module `import` statements as namespace access, module-level mocks must be installed **before** the module under test is loaded — use `mockModule()` then `reloadModule()`.

### Frontend (Vitest + Playwright)

The frontend uses Vitest in browser mode (Chromium via Playwright). Tests import Angular components and test them via the DOM. Chromium must be installed before the first run: `npx playwright install chromium`.

---

## Code style

- **Prettier**: single quotes, 140-char line width, no trailing commas, arrow parens omitted (`x => x`).
- **ESLint**: TypeScript ESLint recommended + stylistic; `@typescript-eslint/no-deprecated` enforced; `console.log` is banned (use `console.info/warn/error`); no `fdescribe`/`fit` in tests.
- Unused variables must be prefixed with `_` to suppress the lint error.

---

## Commit format

```
type(scope): message in lower case
```

Types: `feat`, `fix`, `chore`, `docs`, `nit`, `refactor`, `test`.  
Example: `fix(opcua): use appropriate timestamp when retrieving data`

Branches: feature work off `main`; urgent production fixes off `stable`.

---

## Platform builds

Production binaries are built with `@yao-pkg/pkg` targeting Node v24. Each connector's native dependencies (better-sqlite3, argon2, isolated-vm, oracledb) must be declared in `pkg.assets` or `pkg.scripts` in `backend/package.json` to be bundled correctly. The frontend is pre-built and embedded. Build scripts for each platform are in `build/deps/`.
