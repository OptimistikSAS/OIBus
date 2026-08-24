# @oibus/pi-afsdk-windows

A Windows-only local package: a small .NET Framework 4.8 console app wrapping the OSIsoft (AVEVA) PI
AF SDK, plus the TypeScript driver (`src/index.ts`) that spawns and talks to it. Consumed by
`backend/src/south/south-pi/south-pi.ts` via `import { PiConnection } from '@oibus/pi-afsdk-windows'`,
resolved today as a local `file:` dependency (see `backend/package.json`) — written the same way it
will look once actually published. Same architecture as `@oibus/oledb-windows` — see that package's
README for the general rationale; this one covers what's specific to PI.

This is the PI module of [OIBusAgentWindows](https://github.com/OptimistikSAS/OIBusAgentRelease)
ported out of that project's OWIN/HTTP agent: instead of a separately installed Windows Service
reachable over a configured `agentUrl`, OIBus spawns this helper itself as a local child process.

## Why .NET Framework 4.8, not modern .NET like the OLE DB helper

`OSIsoft.AFSDK.dll` targets .NET Framework and is **not runtime-compatible with modern .NET** —
confirmed directly: running it under `net9.0-windows` throws
`System.MissingMethodException: Method not found: 'DirectoryInfo.GetAccessControl()'` deep inside the
SDK's own configuration-loading path. That instance method was removed from the BCL in .NET Core/5+;
no compatibility NuGet package can restore it (they only add *extension* methods, which don't satisfy
IL that already references an instance method by exact signature). This is specific to the AF SDK —
`System.Data.OleDb` (the OLE DB helper's dependency) has no such issue and runs fine on
`net9.0-windows`. Retargeting this project to `net48` (matching `OIBusAgentWindows` itself) resolved
it — confirmed by testing: the SDK then gets as far as its own "PI client tools not installed" error
instead, which is the expected failure mode in an environment without the PI System client tools.

`OSIsoft.AFSDK.dll` alone is not sufficient to actually connect to a PI server — that also requires
the PI System client tools (a separate, standard PI System install) to be present on the host machine,
same as `OIBusAgentWindows` already required. This package's own dev/test environment has neither a PI
Data Archive nor the client tools installed, so live connectivity could not be verified end-to-end the
way the OLE DB helper was against a real SQL Server — only the assembly-loading fix and the
error-handling path (a real `FileNotFoundException` from the SDK, correctly wrapped and surfaced
through the JSON protocol) were confirmed directly.

`OSIsoft.AFSDK.dll` is vendored under `libs/` (same as `OIBusAgentWindows` does) since it isn't
available on NuGet — it ships with the PI System client tools / PI AF SDK installer. This is a
proprietary AVEVA binary; redistribution terms are whatever PI System SDK developer agreement
Optimistik holds with AVEVA — not something to assume covers every distribution channel automatically.

## Architecture

Same shared/multiplexed-process design as `@oibus/oledb-windows` (one process for the whole OIBus
instance, connections tracked by a UUID `id`, requests/responses correlated by `requestId`, commands
on the same connection id kept in order via a per-connection task chain on the .NET side while
different connections run fully concurrently) — see that package's README for the full rationale.

**PI-specific difference**: there is only ever **one** underlying PI server connection per machine —
`OSIsoft.AF.PI.PIServers().DefaultPIServer`, the server configured via the PI System client tools on
that host. `OIBusAgentWindows`'s own `PIService` was already a process-wide singleton regardless of
which south connector called it; this helper preserves that. Every logical connection `id` still gets
tracked (for consistency with the OLE DB helper's shape, and in case named-server support is ever
added), but they all share the one real `PIServer`. `disconnect` deliberately does **not** tear down
that underlying connection — neither did `OIBusAgentWindows`'s `PIController.Disconnect()`, which was
a no-op — reconnecting to a PI server is comparatively expensive, so it stays alive on the helper
process for as long as that process runs; only the logical `id` bookkeeping is cleared.

**Error recovery**: certain PI RPC error strings (timeout, no connection, RPC resolver off-line,
broken connection — the same list `OIBusAgentWindows`'s `PIController.ManageError` used) mean the
connection is broken beyond in-process recovery, so the helper process kills itself and OIBus's own
reconnect logic (which respawns the helper on the next `connect()`) takes over — the same recovery
model the agent already used.

**Bug found and fixed by testing, not just unit tests**: a short-lived process fed input via a
redirected file could exit (stdin EOF) *before* its own `Task.Run`-dispatched work for already-received
commands had actually executed, silently dropping responses. Fixed by draining
`lastOperationByConnection`'s tasks via `Task.WhenAll` before the process actually returns. **This same
latent issue exists in `@oibus/oledb-windows`'s `Program.cs` too** (it wasn't caught there because that
helper was only tested against a long-lived child process that never closed stdin) — worth
back-porting this fix to the OLE DB helper as a follow-up.

## Protocol

Newline-delimited JSON on stdin/stdout, requests/responses correlated by `requestId`:

```jsonc
{"requestId":"1","command":"connect","id":"<connection-uuid>"}
{"requestId":"2","command":"read","id":"<connection-uuid>","startTime":"...","endTime":"...","points":["sinusoid","sinu*"]}
{"requestId":"3","command":"disconnect","id":"<connection-uuid>"}
```

Responses. `ok` only ever appears on `connect`/`disconnect` (a plain success/failure signal, plus
`serverInfo` on a successful connect); `read` has no `ok` at all — `error`'s presence is the only
failure signal, `values`' presence the only success signal, since there's no partial-failure state left
to report once a read is a single bulk call (see below):

```jsonc
{"requestId":"1","ok":true,"serverInfo":{"name":"PIServer1","version":"3.4.400.1198","host":"pi-server","port":5450}}
{"requestId":"2","values":[{"pointId":"sinusoid","timestamp":"2024-01-01T00:00:00.000Z","value":"12.3"}]}
{"requestId":"3","ok":true}
```

A failed read looks like `{"requestId":"2","error":"..."}` — no `values`, no `ok`. The south connector
is the one that logs a read failure (`Program.cs` never logs its own errors, just reports them); see
`south-pi.ts`'s `historyQuery`.

`points` is a flat list of PI point name masks — no `type` or item `name` on the wire at all, matching
`SouthPIItemSettings`'s own single `piPoint` field one-for-one (an exact tag name or a wildcard pattern,
no longer a separate choice — see the migration note below).
`PIPoint.FindPIPoints(server, IEnumerable<string> names)` resolves any mix of exact names and wildcard
masks (`*`, `?`) in **one bulk call**, so there's no need to split them into two calls the way
`OIBusAgentWindows`'s own `PIController.cs` did (a bulk names call for `PointId` items, a separate
per-item call for `PointQuery` items) — that split mattered only because the original agent's
`PointQuery` path happened to use a *different* `FindPIPoints` overload (the single-string `nameFilter`
form) than its `PointId` path (the bulk `names` form); both turn out to accept wildcard masks, so one
overload covers both. `PIPointList.RecordedValues` with paging (`PIPageType.EventCount`, 20000) is
unchanged from the original. `pointId` in the response is always the raw `PIPoint.Name` the AF SDK
resolved — for a wildcard mask that's the only name there ever is (one mask can match several real
points); the south connector maps it back to its own item's `name` using `piPoint` (see
`south-pi.ts`'s `toTimeValues`/`toPoints`), not anything carried over the wire.

`serverInfo` (`{name, version, host, port}`, off `PIServer`/`PIConnectionInfo`) is gathered once on
`connect` and carried on every `PiConnection` — `south-pi.ts` logs it on connect and surfaces it from
`testConnection()` so the UI's "test connection" result shows which PI server was actually reached.

**Item settings migration**: the entity migration that drops `agentUrl` (`v3.10.0_3.ts`) also converts
every existing PI item from `{type: 'point-id'|'point-query', piPoint?, piQuery?}` down to a single
`{piPoint}` (taking whichever of the two old fields was set) — the old two-shape split existed only
because the original agent used two different `FindPIPoints` overloads; now that both are the same
call, the item shape no longer needs to distinguish them either.

**Caveat**: the "one bulk call handles both exact names and wildcard masks" merge is based on
documented AF SDK behavior for this overload, not confirmed against a live PI server in this
environment (same live-connectivity gap disclosed above for the whole package) — if that assumption
ever turns out wrong for some PI Data Archive version, splitting back into two calls (see this
package's git history around this comment) is a small, contained revert.

## Build

TypeScript side: `npm run build` (plain `tsc`) from this folder, producing `dist/index.js` +
`dist/index.d.ts`. Checked into the repo for now since there's no publish pipeline yet.

.NET side (requires the .NET Framework 4.8 targeting pack, part of the standard Visual Studio Build
Tools workload):

```bash
dotnet build -c Release
```

Framework-dependent (not self-contained/single-file the way the OLE DB helper's `net9.0-windows`
publish is — .NET Framework doesn't support that model) — relies on .NET Framework 4.8 being present
on the host, which is standard on all supported Windows versions. Wiring the build output into
`runtimes/<arch>/OIBusPiAfSdkWindows.exe` (what `resolvePiBinaryPath()` expects) and into the OIBus
Windows `pkg` build's `pkg.assets` is a follow-up build-pipeline task, not yet automated — same as for
the OLE DB helper.
