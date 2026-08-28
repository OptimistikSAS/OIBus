# @oibus/oledb-windows

A Windows-only local package: a small .NET console app wrapping `System.Data.OleDb`, plus the
TypeScript driver (`src/index.ts`) that spawns and talks to it. Consumed by
`backend/src/south/south-oledb/south-oledb.ts` via `import { OleDbConnection } from '@oibus/oledb-windows'`,
resolved today as a local `file:` dependency (see `backend/package.json`) — written the same way it
will be once this is a real published package, so nothing in `south-oledb.ts` needs to change when
that happens.

This is the OLE DB module of [OIBusAgentWindows](https://github.com/OptimistikSAS/OIBusAgentRelease)
ported out of that project's OWIN/HTTP agent: instead of a separately installed Windows Service
reachable over a configured `agentUrl`, OIBus spawns this helper itself as a local child process — no
install, no service registration, no network configuration. The same pattern is planned for OPC and PI.

## Why a separate process at all

`System.Data.OleDb` is Windows-only and COM-based; there's no way to call it directly from OIBus's
Node.js backend. Unlike ODBC (where the `odbc` npm package ships a native addon with prebuilt
binaries), no maintained Node/COM bridge currently builds on OIBus's pinned Node/Windows toolchain —
`winax` (and `node-activex`, which turns out to be the same published package) fail to compile there
due to a live upstream Node.js bug ([nodejs/node#64674](https://github.com/nodejs/node/issues/64674)),
confirmed by actually trying it. Keeping the actual OLE DB access in a small .NET helper — the same
`System.Data.OleDb`-based logic OIBusAgentWindows already used — and changing only how OIBus talks to
it avoids re-deriving OLE DB/COM access from scratch while still getting rid of the standalone agent.

## Architecture

**One shared child process for the whole OIBus instance**, not one process per connection. Any number
of `OleDbConnection`s — from the same or different south connectors, against the same or different OLE
DB targets — multiplex over that single process:

- The process is spawned lazily on the first `OleDbConnection.connect()` call anywhere in the OIBus
  process, and stopped once the last open connection calls `disconnect()` (reference-counted).
- Each logical connection gets a stable `id` (a UUID generated in `index.ts`) that the .NET side uses
  as a key into its own dictionary of open `OleDbConnection`s (mirroring how OIBusAgentWindows already
  tracked one connection per south-connector id).
- Commands on the **same** connection id are processed strictly in the order they were sent (connect,
  then reads, then disconnect) — enforced on the .NET side by chaining each command onto that
  connection's previous command (`lastOperationByConnection` in `Program.cs`).
- Commands on **different** connection ids run **fully concurrently** — a slow query on one
  connection never blocks a fast query on another, verified directly with a 2-second `WAITFOR DELAY`
  query on one connection racing a fast query on another: the fast one's response returns first.

## Protocol

Newline-delimited JSON on stdin/stdout. Every request carries a `requestId`; every response echoes it
back unchanged so the JS side (`OleDbBridge` in `index.ts`) can match a response to the right caller
regardless of arrival order — necessary since different connections' responses can arrive out of order.

Requests:

```jsonc
{"requestId":"1","command":"connect","id":"<connection-uuid>","connectionString":"..."}
{"requestId":"2","command":"read","id":"<connection-uuid>","sql":"...","readTimeout":15000}
{"requestId":"3","command":"disconnect","id":"<connection-uuid>"}
```

Responses:

```jsonc
{"requestId":"1","ok":true}
{"requestId":"2","ok":true,"rows":[{"col1":1,"col2":"a"},{"col1":2,"col2":"b"}]}
{"requestId":"3","ok":false,"error":"..."}
```

Rows are returned as-is (column name → value, `DBNull` → `null`, dates as ISO-8601 strings) — no
server-side datetime parsing or CSV building. `south-oledb.ts` emits `record-list` content (like
`south-mssql`/`south-mysql`/etc. already do) and relies on a north-side `record-list-to-csv`
transformer for any CSV rendering; the only datetime handling on the OIBus side is tracking the
incremental query cursor via `item.settings.trackingInstant`.

## Package layout

```
oledb-windows/
├── package.json         "@oibus/oledb-windows" — main/types point at dist/
├── tsconfig.json
├── src/
│   ├── index.ts          OleDbBridge (process + protocol) and OleDbConnection (public API)
│   └── index.spec.ts
├── dist/                 built output (checked in for now — no publish pipeline yet)
├── OleDbWindows.csproj   .NET 9 (net9.0-windows) console app
├── Program.cs
└── runtimes/<arch>/           per-architecture published binaries (not yet produced by the build — see below)
```

## Build

TypeScript side: `npm run build` (plain `tsc`) from this folder, producing `dist/index.js` +
`dist/index.d.ts`. Checked into the repo for now since there's no publish pipeline yet — rebuild and
commit `dist/` after changing `src/index.ts`.

.NET side, self-contained single-file publish, one per architecture (requires the .NET 9 SDK):

```bash
dotnet publish -c Release -r win-x64   -p:SelfContained=true -p:PublishSingleFile=true
dotnet publish -c Release -r win-x86   -p:SelfContained=true -p:PublishSingleFile=true
dotnet publish -c Release -r win-arm64 -p:SelfContained=true -p:PublishSingleFile=true
```

Wiring the published binaries into `runtimes/<arch>/OIBusOleDbWindows.exe` — deliberately not named
`bin/`, which is .NET's own build-output folder (see `.gitignore`) — is what `resolveOleDbBinaryPath()`
in `index.ts` expects. Doing that copy, and adding this package's `runtimes/` to the OIBus Windows
`pkg` build's `pkg.assets`, is a follow-up build-pipeline task, not yet automated.
