---
sidebar_position: 1
---

# Tuning South History Call Settings

[Common Settings](../south-connectors/common-settings.md) introduces the four history-capable-connector timing fields —
**Max read interval**, **Read delay**, **Start time offset**, **End time offset** — plus **Recovery strategy**,
and shows where they live on an item or group. This page goes one level deeper: the mental model behind what
each setting actually does to a query, and worked scenarios for deciding _what value_ to use and _why_.

These settings only exist on South connectors with historian capabilities (SQL connectors, OPC UA in HA mode,
OPC Classic in HDA mode, OSIsoft PI, OIAnalytics, REST, InfluxDB — see the full list in
[History Queries](../history-queries.md#compatible-south-connectors)). Streaming-only connectors (MQTT, Modbus,
folder/FTP/SFTP scanners) have no time range to slice, so none of this applies to them.

## The mental model: one run, four decisions {#the-mental-model-one-run-four-decisions}

Every time a history-capable item or group runs, OIBus goes through the same four steps in order:

1. **Compute the effective window.** Start from the tracked instant (the end of the last successful query) and
   the current time, then apply `Start time offset` and `End time offset` to both ends. If the resulting end is
   not after the resulting start, the run is skipped entirely for this tick — nothing is queried and the
   tracked instant does not move.
2. **Split into sub-intervals.** The effective window is chopped into consecutive chunks of at most
   `Max read interval` seconds each (the last chunk is shorter). A value of `0` (or leaving it empty) disables
   splitting — the whole window is queried in one call.
3. **Query each sub-interval in order**, pausing `Read delay` milliseconds between one sub-query and the next
   (never before the first, never after the last). `Recovery strategy` decides whether that order is
   oldest-first (default) or newest-first.
4. **Advance the tracked instant.** With `oldest`, it moves forward after _each_ sub-interval that returns data
   more recent than what's already tracked — so a crash mid-run only loses the interval in flight. With
   `newest`, it only moves once _every_ sub-interval has completed, so a mid-run restart can't skip an
   older, not-yet-queried chunk.

Offsets are applied once, to the two ends of the whole window — never re-applied to each sub-interval produced
by step 2.

```
tracked instant                                                            now
|                                                                            |
Start time offset                                              End time offset
v                                                                            v
+----------------------------- effective window -----------------------------+

+---sub-interval 1---+---sub-interval 2---+---sub-interval 3---+----last-----+
                                          ^
                                Read delay pause here
```

`Start time offset` and `End time offset` each land one edge of the effective window — a negative value moves
that edge earlier, a positive value moves it later; the diagram doesn't assume either direction, since it
depends entirely on the sign you configure. Splitting only happens _after_ both edges are set: `sub-interval 1`
starts exactly at the effective start above, and the last sub-interval ends exactly at the effective end, no
matter how the offsets moved those edges to get there. The read-delay pause shown above repeats between every
consecutive pair of sub-intervals — never before the first, never after the last.

The rest of this page walks through why you'd push each of these knobs away from its default.

## Max read interval: bounding how much a single query asks for {#max-read-interval-bounding-how-much-a-single-query-asks-for}

`Max read interval` exists to protect both the source and OIBus from a single query that's simply too big —
which happens whenever the data source holds **many values** for the requested window.

### Example: a wide backlog {#example-a-wide-backlog}

Say a connector collects 200 tags at 1 sample/second: 200 rows/second, or roughly 720,000 rows/hour. If this
connector is stopped for maintenance for 24 hours, the very next run's window spans the full outage — without
splitting, that's a single query asking the source for over 17 million rows in one round trip. Depending on the
source, that can mean a multi-minute query that locks a table, a timeout, an out-of-memory error on either side,
or simply a payload too large for the connector's driver to buffer.

Setting `Max read interval` to, say, `3600` (1 hour) turns that one giant query into 24 sequential ~720,000-row
queries. Each one is small enough to complete quickly and predictably, and — combined with the `oldest`
recovery strategy — every completed hour is durably checkpointed, so a restart during the catch-up only repeats
the one hour that was in flight, not the whole day.

### Sizing it {#sizing-it}

- **Base it on what the source (and the network) can comfortably return in one call** — see
  [Data Rate and Cache Sizing](./oibus-data-rate.mdx) for how to translate a row count into a byte estimate.
  A source with strict query timeouts or limited server-side memory wants a smaller interval; a source that
  handles wide range scans efficiently (e.g. a time-series database with proper indexing) can use a larger one.
- **Don't shrink it just because the steady-state rate is low.** The setting has to survive the worst case —
  the longest realistic backlog (a weekend outage, a network partition) — not just normal ticks where the
  window is naturally small anyway.
- **`0` (no splitting) is fine for low-volume sources** where the window is always small in practice, but is
  risky for anything that might accumulate a large backlog after downtime, since the very next run becomes one
  unbounded query.

:::warning SQL-like connectors must reference both time variables in the query
For SQL-based connectors (MSSQL, MySQL/MariaDB, ODBC, OLEDB, Oracle, PostgreSQL, SQLite) and REST, OIBus has no
way to bound a query on its own — it only ever substitutes the variables your query text asks for. `Max read
interval` only has an effect if the query explicitly filters on **both** `@StartTime` and `@EndTime`:

```sql
SELECT * FROM sensor_data
WHERE timestamp > @StartTime
AND timestamp <= @EndTime
```

If `@EndTime` is missing from the query, every sub-interval still fetches from `@StartTime` onward with no
upper bound — splitting produces the same oversized, unbounded result each time instead of a series of smaller
ones. If `@StartTime` is missing too, every run simply re-reads the same fixed result set.

Connectors that manage their own historical read internally — OPC UA (HA mode), OPC Classic (HDA mode), and
OSIsoft PI — don't have this caveat: OIBus passes the sub-interval's start and end directly into the
connector's own historical-read call, so `Max read interval` always bounds the query regardless of how the tags
are configured.
:::

## Read delay: pacing consecutive sub-queries {#read-delay-pacing-consecutive-sub-queries}

`Read delay` inserts a pause between sub-queries so a large `Max read interval` split doesn't turn into a burst
of back-to-back requests hammering the source — useful for rate-limited APIs (REST, OIAnalytics), production
databases that shouldn't be monopolized, or PLC/historian servers that need a moment to service the previous
request before the next one arrives.

### The interaction with Max read interval {#the-interaction-with-max-read-interval}

The two settings trade off directly. Total pacing overhead for one run is approximately:

```
overhead ≈ (number of sub-intervals − 1) × Read delay
```

A 24-hour backlog split into 24 one-hour chunks with a 1-second `Read delay` adds about 23 seconds of total
pause time — negligible. But the same 24-hour backlog split into 1-minute chunks (1,440 sub-intervals) at the
same 1-second delay adds almost **24 minutes** of pure pacing, on top of the 1,440 round trips themselves. If
you shrink `Max read interval` to reduce load per query, check what that does to catch-up time on a realistic
backlog before assuming a small `Read delay` is harmless.

### Sizing it {#sizing-it-1}

| Symptom                                                                  | Adjustment                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Source rejects requests, rate-limits, or degrades under repeated polling | Increase `Read delay`                                     |
| Catching up a large backlog takes far longer than the backlog itself     | Decrease `Read delay` and/or increase `Max read interval` |
| Source has no rate concerns at all (local file-backed DB, etc.)          | `0` is fine                                               |

## Start/End time offset: when the source isn't done writing yet {#startend-time-offset-when-the-source-isnt-done-writing-yet}

This is the setting that matters most when **several items queried together are not all digested by the data
source at the same moment**.

### Why this happens {#why-this-happens}

Many historian-style sources don't make a value durably queryable the instant it's timestamped. A SQL table
might commit inserts in periodic batches; an OPC UA HA server typically buffers newly historized samples locally
before flushing them to its underlying store; a PI or OPC Classic HDA server resolves a multi-tag read
internally, one tag at a time. That last case is the concrete "several items together" scenario: a single
batched query for a group of items can see tag A's value already flushed and queryable, while tag B's value for
that very same instant is still sitting in an internal buffer a few hundred milliseconds behind — because the
group is queried as one call sharing one tracked instant, that inconsistency isn't visible per item.

If OIBus queries `[tracked instant, now]` and immediately advances the tracked instant to `now`, any value that
wasn't yet digested by the source at query time is gone for good — the next run starts strictly after it and
will never ask for that slice of time again.

### Start time offset: re-request a safety cushion {#start-time-offset-re-request-a-safety-cushion}

A **negative** `Start time offset` (e.g. `-2000` for a 2-second cushion) shifts the start of the window
backward, so OIBus re-asks for a slice of time it already covered on the previous run. Any value that had not
yet been digested last time gets a second chance to show up this time. This relies on the query (or a
deduplication step downstream) tolerating an already-seen row being returned again — true for most
timestamp-keyed SQL queries and for North-side handling of duplicate timestamps.

Size the negative offset a bit larger than the source's known or observed commit/flush lag. If you don't know
that lag, start conservative (e.g. `-5000`) and tighten it once you've confirmed no gaps appear at the boundary.

### End time offset: don't touch the fuzzy region at all {#end-time-offset-dont-touch-the-fuzzy-region-at-all}

A **negative** `End time offset` takes the opposite approach: instead of re-querying a cushion next time, it
pulls the end of _this_ window back so the not-yet-reliable trailing edge is never queried in the first place.
This suits eventually-consistent sources where re-querying isn't safe or convenient — for example, an API
backed by a materialized view that only refreshes every few seconds, where asking for data "as of right now"
can return a partial or soon-to-change result.

The trade-off versus `Start time offset` is really about reactivity, not about missing data — neither approach
actually loses values. `Start time offset` duplicates values it already queried, but in exchange a late value
gets picked up as soon as possible, on the very next run after it becomes available, since that run re-asks for
the same trailing slice. `End time offset` never duplicates a value, but it delays every value in the shrunk
trailing region by at least one run: since the tracked instant only ever advances up to the shrunk end, that
region simply becomes part of the _next_ run's window instead of being queried now.

### Example: a 2-second commit lag, visualized {#example-a-2-second-commit-lag-visualized}

Toy example: a source commits values 2 seconds after their timestamp, and a scan mode polls it every 5
seconds — an exaggerated ratio, purely to make the pattern visible. Every run's window ends 2 seconds into
data the source hasn't committed yet: that trailing slice (marked `███` below) is the "risky zone." What
differs between the three approaches is how each one treats it.

```
No offset — the risky zone is dropped, every single run
  run @:15   [:10 ─────────── :13 ███ :15)        tracked instant → :15
  run @:20   [:15 ─────────── :18 ███ :20)        tracked instant → :20   (:13-:14 never revisited — LOST)
  run @:25   [:20 ─────────── :23 ███ :25)        tracked instant → :25   (:18-:19 never revisited — LOST)

Start time offset = -2s — the risky zone is re-asked and recovered, but duplicated
  run @:15   [:08 ▒▒▒ :10 ─────────── :13 ███ :15)   tracked instant → :15
  run @:20   [:13 ▒▒▒ :15 ─────────── :18 ███ :20)   :13-:14 now committed → RECOVERED (re-read, duplicate)
  run @:25   [:18 ▒▒▒ :20 ─────────── :23 ███ :25)   :18-:19 RECOVERED the same way — repeats every run

End time offset = -2s — the risky zone is never queried, just deferred
  run @:15   [:10 ─────────── :13)                   tracked instant → :13   (window never reaches :13-:14)
  run @:20               [:13 ─────────── :18)       :13-:14 collected here — one run later, never duplicated
  run @:25                           [:18 ─────────── :23)   :18-:19 collected here — same one-run delay, repeats
```

`███` = requested by the window but not yet committed by the source, so the query silently returns nothing for
it. `▒▒▒` = a slice that was `███` last run, re-requested now that the source has caught up.

With no offset, every run permanently loses its own trailing 2 seconds. `Start time offset` trades a harmless
duplicate read for recovering that same 2 seconds one run later. `End time offset` never duplicates anything,
but the price is that everything in the last 2 seconds of "now" always arrives one full run late.

The same picture applies to a batched group query, just along a different axis. Instead of one source lagging
behind a fixed amount of time, picture items A and B read together at every tick (`:15`, `:20`, `:25`, ...):
item A's value for `:15` may already be stored by the time the group is queried, while item B's value for that
very same `:15` sample is written a moment later — so the risky zone is the tick boundary itself, for whichever
item hasn't caught up yet, rather than a fixed trailing slice of time. The same three outcomes still hold: with
no offset, item B's `:15` sample is silently dropped for good the moment the tracked instant advances past it;
a negative `Start time offset` re-asks the `:15` boundary on the next tick and recovers item B's value (at the
cost of a harmless duplicate read of item A's, which was already there); a negative `End time offset` simply
never asks for a tick until the run after, by which point every item in the group is expected to have caught up.

### Choosing between them {#choosing-between-them}

| Situation                                                                                    | Use                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------- |
| Source occasionally commits a value slightly late; duplicate reads are harmless              | Negative `Start time offset`            |
| Source's most recent data is unreliable/partial until it settles; re-querying is undesirable | Negative `End time offset`              |
| A batched multi-item query (OPC UA HA, PI, HDA) where items don't all flush at once          | Negative `End time offset` on the group |
| OIBus's clock runs behind the data source's clock                                            | Positive `End time offset`              |

A positive `End time offset` is mainly useful for **clock alignment**: if OIBus's own clock runs behind the
data source's by a roughly known amount, the source can already have data timestamped later than what OIBus
considers "now". Pushing the query's upper bound forward by that same drift lets OIBus retrieve up to the
source's actual current time instead of stopping short at its own, lagging clock.

## Recovery strategy: order and durability during catch-up {#recovery-strategy-order-and-durability-during-catch-up}

`Recovery strategy` only matters once there's more than one sub-interval to work through — i.e., whenever a
backlog (first run, downtime, a widened `Start time offset`) produces several chunks in a single tick.

- **`From oldest to newest` (default)** processes the backlog chronologically and checkpoints the tracked
  instant after each chunk. A crash or restart mid-catch-up only re-queries the one chunk that was in flight.
  Dashboards stay behind reality until the whole backlog is cleared.
- **`From newest to oldest`** queries the most recent chunk first, so current values become available
  immediately, then backfills older chunks afterward. The tracked instant only advances once the _entire_
  backlog for that run has completed — a mid-run restart re-queries the whole backlog rather than resuming
  partway, trading crash-safety for faster visibility of "now."

Pick `newest` when a dashboard or downstream consumer needs current values as soon as possible even while a
long backfill is still catching up on history. Keep `oldest` (the default) when incremental, crash-safe
progress matters more than how quickly "now" appears — which is the right choice for most unattended setups.

## Putting it together: a worked example {#putting-it-together-a-worked-example}

A South MSSQL connector polls 200 tags from a historian table. The database batches inserts and typically
commits within 1.5 seconds of the sample timestamp. The team wants dashboards to show current values quickly
even after a maintenance window, but also wants crash-safe progress if a backfill is interrupted.

| Setting               | Value                   | Reasoning                                                                                                                          |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Max read interval** | `900`                   | 15-minute chunks keep each query's row count (~180,000 rows at this rate) comfortably within the source's response time budget.    |
| **Read delay**        | `500`                   | Enough pacing to avoid competing with production traffic on the same database, without meaningfully slowing a multi-hour catch-up. |
| **Start time offset** | `-2000`                 | A 2-second cushion, comfortably above the observed 1.5-second commit lag.                                                          |
| **Recovery strategy** | `From oldest to newest` | Crash-safety was prioritized over immediate visibility of "now" for this connector.                                                |

If the same team instead needed the live dashboard to reflect current values immediately during a long
weekend-outage catch-up — accepting that a mid-catch-up restart would re-run the whole backlog — they'd switch
`Recovery strategy` to `From newest to oldest` and leave the other three values as is.

## Common pitfalls {#common-pitfalls}

- **`Max read interval` too large for the source.** The very next run after any real backlog becomes one
  oversized query — the same problem the setting exists to prevent.
- **`Max read interval` too small for the backlog you actually see.** Turns a data-volume problem into an
  interval-count problem: thousands of tiny sub-queries, each paying the full `Read delay` pause. Check the
  overhead formula above against your worst-case backlog, not just the steady state.
- **Forgetting offsets apply once to the whole window, not per sub-interval.** Splitting by `Max read interval`
  happens _after_ offsets are applied to the effective start/end — a sub-interval boundary in the middle of a
  split window is never independently offset.
- **An `End time offset` that's consistently larger than the polling interval.** If the scan mode fires more
  often than the offset shrinks the window, some runs compute an end that isn't after the start and are skipped
  outright — visible as a run that logs a skipped query with no data collected.
- **Changing these settings on a connector with an established tracked instant.** The very next run applies the
  new values starting from the current tracked instant; a large jump in `Max read interval` or either offset can
  produce a small gap or a duplicate at that boundary. See
  [Common Settings — Max Instant Tracking](../south-connectors/common-settings.md#max-instant-tracking) for the
  full picture of how the tracked instant behaves across configuration changes.

## Quick reference {#quick-reference}

| Goal / symptom                                                                       | Adjust                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Source times out or runs out of memory on wide queries                               | Lower `Max read interval`                           |
| Catching up a large backlog is dominated by pauses, not the queries themselves       | Raise `Max read interval` and/or lower `Read delay` |
| Source rate-limits, degrades, or errors under repeated polling                       | Raise `Read delay`                                  |
| Need late-arriving values as soon as they exist, duplicates are acceptable           | Negative `Start time offset`                        |
| Must avoid duplicate reads, can wait until the next run for already-available values | Negative `End time offset`                          |
| Dashboards must show current values fast during a long backfill                      | `Recovery strategy` → `newest`                      |
| Backfill must be crash-safe with minimal repeated work                               | `Recovery strategy` → `oldest` (default)            |
