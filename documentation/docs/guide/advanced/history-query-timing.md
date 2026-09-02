---
sidebar_position: 1
---

# Advanced tuning of History Connectors

This page explains in detail how to use the `Max read interval`, `Read delay`, `Start time offset`, `End time offset` —
plus `Recovery strategy` — fields. These are found only on connectors that access data sources with historical storage:
SQL connectors, OPC UA in HA mode, OPC Classic in HDA mode, OSIsoft PI, OIAnalytics, REST, InfluxDB — see the full list
in [History Queries](../history-queries.md#compatible-south-connectors). These settings are introduced in
[Common Settings](../south-connectors/common-settings.md).

This page does not apply to streaming-only connectors (MQTT, Modbus, folder/FTP/SFTP scanners), which only have access
to current data.

The page explains the algorithm used and gives some use cases.

## The history query strategy {#the-history-query-strategy}

Every time a history-capable item or group runs, OIBus goes through the same four steps in order:

1. **Compute the effective window.** Start from the tracked instant and the current time, then apply `Start time offset`
   and `End time offset` to both ends. If the resulting end isn't after the resulting start, the run is skipped entirely
   for this tick — nothing is queried and the tracked instant does not move.
2. **Split into sub-intervals.** The effective window is chopped into consecutive slices of at most
   `Max read interval` seconds each (the last slice may be shorter). A `Max read interval` value of `0` (or leaving it
   empty) disables splitting — the whole window is queried in one call (not recommended).
3. **Query each sub-interval in order**, pausing `Read delay` milliseconds between one sub-query and the next (never
   before the first, never after the last). The `Recovery strategy` decides whether that order is oldest-first (default)
   or newest-first.
4. **Advance the tracked instant.** With `From oldest to newest`, the tracked instant moves forward after _each_
   sub-interval that returns data more recent than previous results. In case of a crash, data will be queried from the
   last tracked instant retrieved. With `From newest to oldest`, the tracked instant only moves once _every_ sub-interval
   has completed. In case of a crash, data will be queried again for the full interval since the tracked instant has not
   advanced yet.

:::info Tracked Instant
The tracked instant denotes the most recent timestamp retrieved from the last successful query.
:::

Offsets are applied once, to the two ends of the whole window — never re-applied to each sub-interval produced by step 2.

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

`Start time offset` and `End time offset` each apply to one edge of the effective window — a negative value moves that
edge earlier (in the past), a positive value moves it later (in the future); the diagram doesn't assume either direction, since it
depends entirely on the sign you configure. Splitting only happens _after_ both edges are set: `sub-interval 1`
starts exactly at the effective start above, and the last sub-interval ends exactly at the effective end, no matter how
the offsets moved those edges to get there. The read-delay pause shown above repeats between every consecutive pair of
sub-intervals — not before the first, not after the last.

The rest of this page explains cases when default settings should be changed.

## Max read interval: bounding how much a single query asks for {#max-read-interval-bounding-how-much-a-single-query-asks-for}

`Max read interval` exists to protect both the source and OIBus from a single query that's simply too big — which
happens whenever the data source holds **many values** for the requested window.

### Example: a wide backlog {#example-a-wide-backlog}

Say a connector collects 200 tags at 1 sample/second: 200 rows/second, or roughly 720,000 rows/hour. If this connector
is stopped for maintenance for 24 hours, the very next run's window spans the full outage — without splitting, that's a
single query asking the source for over 17 million rows in one round trip. Depending on the source, that can mean a
multi-minute query that locks a table, a timeout, an out-of-memory error on either side, or simply a payload too large
for the connector's driver to buffer.

Setting `Max read interval` to, say, `3600` (1 hour) splits that big query into 24 sequential smaller ~720,000-row
queries. Each one is small enough to complete quickly and predictably, and — combined with the `From oldest to newest`
recovery strategy — every completed hour is durably checkpointed. A restart during the catch-up only repeats the one
hour that was in flight, not the whole day.

### Choosing the right value for Max read interval {#choosing-the-right-value-for-max-read-interval}

- **Base it on what the source (and the network) can comfortably return in one call** — see
  [Data Rate and Cache Sizing](./oibus-data-rate.mdx) for how to translate a row count into a byte estimate. A source
  with strict query timeouts or limited server-side memory wants a smaller interval; a source that handles wide range
  scans efficiently (e.g. a time-series database with proper indexing) can use a larger one.
- **Don't shrink it just because the steady-state rate is low.** The setting has to survive the worst case — the longest
  realistic backlog (a weekend outage, a network partition) — not just normal operation where the window is naturally
  small anyway.
- **`0` (no splitting) is fine for low-volume sources** where the window is always small in practice, but is risky for
  anything that might accumulate a large backlog after downtime, since the next run would become one unbounded query.

:::warning SQL-like connectors must reference both time variables in the query

For SQL-based connectors (MSSQL, MySQL/MariaDB, ODBC, OLEDB, Oracle, PostgreSQL, SQLite) and REST, OIBus runs the query,
replacing `@StartTime` and `@EndTime` with the computed sub-interval's bounds. Both variables are therefore necessary
for `Max read interval` to have any effect.

```sql title="Example of a SQL query with @StartTime and @EndTime"
SELECT *
FROM sensor_data
WHERE timestamp > @StartTime
  AND timestamp <= @EndTime
```

If `@EndTime` is missing from the query, every sub-interval still fetches everything from `@StartTime` onward with no
upper bound (up to the last record) — every sub-query ends up large and returns mostly the same values. If
`@StartTime` is also missing, every sub-query simply re-reads the same fixed result set.

Connectors that manage their own historical read internally — OPC UA (HA mode), OPC Classic (HDA mode), and OSIsoft PI —
don't have this caveat: OIBus passes the sub-interval's start and end directly into the connector's own historical-read
call, so `Max read interval` always bounds the query regardless of how the tags are configured.
:::

## Read delay: pacing consecutive sub-queries {#read-delay-pacing-consecutive-sub-queries}

`Read delay` inserts a pause between sub-queries so a large `Max read interval` split doesn't turn into a burst of
back-to-back requests hammering the source — useful for rate-limited APIs (REST, OIAnalytics), production databases that
shouldn't be monopolized, or PLC/historian servers that need a moment to service the previous request before the next
one arrives.

### The interaction of Read delay with Max read interval {#the-interaction-of-read-delay-with-max-read-interval}

The two settings trade off directly. The total delay added to a single run is approximately:

```
Total delay ≈ (number of sub-intervals − 1) × Read delay
```

A 24-hour backlog split into 24 one-hour chunks with a 1-second `Read delay` adds about 23 seconds of total pause time —
negligible. But the same 24-hour backlog split into 1-minute chunks (1,440 sub-intervals) at the same 1-second delay
adds almost **24 minutes** of pure waiting, on top of the 1,440 round trips themselves. If you shrink `Max read interval`
to reduce load per query, check what that does to catch-up time on a realistic backlog before assuming a small
`Read delay` is harmless.

### Choosing the right value for Read delay {#choosing-the-right-value-for-read-delay}

| Symptom                                                                  | Adjustment                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Source rejects requests, rate-limits, or degrades under repeated polling | Increase `Read delay`                                     |
| Catching up a large backlog takes far longer than the backlog itself     | Decrease `Read delay` and/or increase `Max read interval` |
| Source has no rate concerns at all (local file-backed DB, etc.)          | `0` is fine                                               |

## Start/End time offset: when the source is still processing the values {#startend-time-offset-when-the-source-is-still-processing-the-values}

This is the setting that matters most when **several items queried together are not all digested by the data source at
the same moment**. Typical symptoms are:

- Not all values are recovered by each query — the number of tags, and even the values themselves, can change from one
  run to the next.
- Repeating the same query over the same period shows that the first run returned fewer values than a later one.

### Why this happens {#why-this-happens}

In many historian-style sources, there is a delay between the instant a value is timestamped and the instant this value
is accessible by a query. A SQL table might commit
inserts in periodic batches; an OPC UA HA server typically buffers newly historized samples locally before flushing them
to its underlying store; a PI or OPC Classic HDA server resolves a multi-tag read internally, one tag at a time. That
last case is the concrete "several items together" scenario: a single batched query for a group of items (containing items A and B) can see tag A's
value already flushed into storage and queryable, while tag B's value for that very same instant is still sitting in an internal
buffer a few hundred milliseconds behind.

#### How does this impact OIBus? {#how-does-this-impact-oibus}

The issue is that OIBus asks for all the tags in the group at the same time. It receives an answer and cannot tell
that some tags are missing — it has no way to know they simply weren't available yet. OIBus then sets the tracked
instant to the latest timestamp recovered, so the next query misses any values that were not yet available in the
historian.

### Start time offset: re-request a safety cushion {#start-time-offset-re-request-a-safety-cushion}

A **negative** `Start time offset` (e.g. `-2000` for a 2-second cushion) shifts the start of the window backward, so
OIBus queries again for a slice of time it already covered in the previous run. Any value that had not yet been digested
last time gets a second chance to be caught by OIBus. As a result, values already collected in the previous run are
received again — this only works if what's downstream (a North connector, a dashboard, a deduplication step) can
tolerate seeing the same value twice.

The negative `Start time offset` should be a bit larger than the source's known or observed commit/flush lag. If you
don't know that lag, start conservative (e.g. `-5000`) and reduce the overlap once you've confirmed no gaps appear at
the boundary.

### End time offset: don't touch the fuzzy region at all {#end-time-offset-dont-touch-the-fuzzy-region-at-all}

A **negative** `End time offset` takes the opposite approach: instead of re-querying a cushion next time, it pulls the
end of _this_ window back so the not-yet-reliable trailing edge is never queried in the first place. This suits
eventually-consistent sources where re-querying isn't safe or convenient — for example, an API backed by a materialized
view that only refreshes every few seconds, where asking for data "as of right now"
can return a partial or soon-to-change result.

The trade-off versus `Start time offset` is really about reactivity, not about missing data — neither approach actually
loses values. `Start time offset` duplicates values it already queried, but in exchange a late value gets picked up as
soon as possible, on the very next run after it becomes available, since that run re-asks for the same trailing slice.
`End time offset` never duplicates a value, but it delays every value in the shrunk trailing region by at least one run:
since the tracked instant only ever advances up to the shrunk end, that region simply becomes part of the _next_ run's
window instead of being queried now.

### Example: a 2-second commit lag, visualized {#example-a-2-second-commit-lag-visualized}

A source commits values 2 seconds after their timestamp, and a scan mode polls it every 5 seconds — an
exaggerated ratio, purely to make the pattern visible. Every run's window ends 2 seconds into data the source hasn't
committed yet: that trailing slice (marked `███` below) is the "risky zone." What differs between the three approaches
is how each one treats it.

**Legend**

- `███` = requested by the window but not yet committed by the source, so the query silently returns nothing for it.
- `▒▒▒` = a slice that was `███` last run, re-requested now that the source has caught up.

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

With no offset, every run permanently loses its own trailing 2 seconds. `Start time offset` queries 7 seconds' worth
of values every 5 seconds — with duplicates — but gets the best reactivity. `End time offset` never duplicates
anything, but all values in the last 2 seconds from "now" always arrive one full run late.

The same principle applies to a batched group query, just along a different axis. Instead of one source lagging behind
a fixed amount of time, picture items A and B read together at every tick (`:15`, `:20`, `:25`, ...): item A's value for
`:15` may already be stored by the time the group is queried, while item B's value for that very same `:15` sample is
written a moment later — so the risky zone is the tick boundary itself, for whichever item hasn't caught up yet,
rather than a fixed trailing slice of time.

The same three outcomes still hold: with no offset, item B's `:15`
sample is silently dropped for good the moment the tracked instant advances past it; a negative `Start time offset`
re-asks the `:15` boundary on the next tick and recovers item B's value (at the cost of a harmless duplicate read of
item A's, which was already there); a negative `End time offset` simply never asks for a tick until the run after, by
which point every item in the group is expected to have caught up.

### Choosing the right solution {#choosing-the-right-solution}

| Situation                                                                                    | Use                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------- |
| Source occasionally commits a value slightly late; duplicate reads are harmless              | Negative `Start time offset`            |
| Source's most recent data is unreliable/partial until it settles; re-querying is undesirable | Negative `End time offset`              |
| A batched multi-item query (OPC UA HA, PI, HDA) where items don't all flush at once          | Negative `End time offset` on the group |
| OIBus's clock runs behind the data source's clock                                            | Positive `End time offset`              |

:::info Positive `End time offset`
A positive `End time offset` is mainly useful for **clock alignment**: if OIBus's own clock runs behind the data
source's by a roughly known amount, the source can already have data timestamped later than what OIBus considers "now".
Pushing the query's upper bound forward by that same drift lets OIBus retrieve up to the source's actual current time
instead of stopping short at its own, lagging clock.
:::

## Recovery strategy: order and durability during catch-up {#recovery-strategy-order-and-durability-during-catch-up}

`Recovery strategy` matters when there is more than one sub-interval to work through — i.e., whenever a
backlog (first run, downtime, a widened `Start time offset`) produces several slices of time.

- **`From oldest to newest` (default)** processes the backlog chronologically and checkpoints the tracked instant after
  each slice of time. A crash or restart mid-catch-up only re-queries the one slice that was in flight. Dashboards stay behind
  reality until the whole backlog is cleared.
- **`From newest to oldest`** queries the most recent slice of time first, so current values become available immediately, then
  backfills older slices afterward. The tracked instant only advances once the _entire_
  backlog for that run has completed — a mid-run restart re-queries the whole backlog rather than resuming partway,
  trading crash-safety for faster visibility of "now."

Pick `From newest to oldest` when a dashboard or downstream consumer needs current values as soon as possible even while a long
backfill is still catching up on history. Keep `From oldest to newest` (the default) when incremental, crash-safe progress matters more
than how quickly "now" appears — which is the right choice for most unattended setups.

## Putting it together: a real-life example {#putting-it-together-a-real-life-example}

A South MSSQL connector polls 200 tags from a historian table. The database batches inserts and typically commits within
1.5 seconds of the sample timestamp. The team wants dashboards to show current values quickly even after a maintenance
window, but also wants crash-safe progress if a backfill is interrupted.

| Setting               | Value                   | Reasoning                                                                                                                          |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Max read interval** | `900`                   | 15-minute chunks keep each query's row count (~180,000 rows at this rate) comfortably within the source's response time budget.    |
| **Read delay**        | `500`                   | Enough pacing to avoid competing with production traffic on the same database, without meaningfully slowing a multi-hour catch-up. |
| **Start time offset** | `-2000`                 | A 2-second cushion, comfortably above the observed 1.5-second commit lag.                                                          |
| **Recovery strategy** | `From oldest to newest` | Crash-safety was prioritized over immediate visibility of "now" for this connector.                                                |

If the same team instead needed the live dashboard to reflect current values immediately during a long weekend-outage
catch-up — accepting that a mid-catch-up restart would re-run the whole backlog — they'd switch
`Recovery strategy` to `From newest to oldest` and leave the other three values as is.

## Common pitfalls {#common-pitfalls}

- **`Max read interval` too large for the source.** The first run after any long stop becomes an oversized
  query — the same problem the setting exists to prevent.
- **`Max read interval` too small for the backlog you actually see.** Turns a data-volume problem into an interval-count
  problem: thousands of tiny sub-queries, each paying the full `Read delay` pause. Check the overhead formula above
  against your worst-case backlog, not just the steady state.
- **Forgetting offsets apply once to the whole window, not per sub-interval.** Splitting by `Max read interval`
  happens _after_ offsets are applied to the effective start/end — a sub-interval boundary in the middle of a split
  window is never independently offset.
- **An `End time offset` whose magnitude is consistently larger than how often the scan mode fires.** This only bites
  when the tracked instant sits close to "now" — right after the item or group starts, or right after its tracked
  instant is reset to a recent value. The effective end of a run is `now + End time offset` (a negative offset pulls
  it back), while "now" only moves forward by one scan-mode tick between runs; until enough real time has passed to
  clear the offset, that effective end keeps landing at or before the still-recent tracked instant, so the run is
  skipped outright — visible as a run that logs a skipped query with no data collected. No data is lost: a skipped
  run never advances the tracked instant, so once `now` has moved past it by more than the offset's magnitude, the
  next run's window is valid again and collection resumes normally.
- **Changing these settings on a connector with an established tracked instant.** The very next run applies the new
  values starting from the current tracked instant; a large jump in `Max read interval` or either offset can produce a
  small gap or a duplicate at that boundary. See
  [Common Settings — Max Instant Tracking](../south-connectors/common-settings.md#max-instant-tracking) for the full
  picture of how the tracked instant behaves across configuration changes.

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
