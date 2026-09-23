---
sidebar_position: 0
---

# Common Settings

A **South connector** fetches data from a specific source (e.g., MQTT broker, MSSQL database) and forwards it to
North caches. Each connector manages one or more **items** — the individual data points or queries to collect.
Items can optionally be organised into **groups** to share a common schedule and throttling configuration.

## Adding a South Connector {#adding-a-south-connector}

1. Navigate to the **South** page.
2. Click the **+** button.
3. Select a connector type and configure its settings.
4. Monitor or adjust settings from the connector's display page.

## General Settings {#general-settings}

| Setting         | Description                                                                   | Example Value         |
| --------------- | ----------------------------------------------------------------------------- | --------------------- |
| **Name**        | User-friendly label for easy identification.                                  | `My MSSQL Connector`  |
| **Description** | Optional context (connection details, access rights, unique characteristics). | `Production database` |
| **Enabled**     | Enable/disable the connector from the list or its display page.               | Enabled/Disabled      |

## Specific Section {#specific-section}

Refer to each connector's documentation for type-specific settings.

### Testing Connection {#testing-connection}

Use the **Test settings** button to verify your connection configuration.

---

## Groups {#groups}

A group bundles items that share the same collection schedule. Each group has:

| Setting              | Description                                                                                                                                  | Example Value  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Name**             | Unique label for the group within this connector.                                                                                            | `Group A`      |
| **Scan mode**        | Schedule used to collect data for all items in the group.                                                                                    | `Every 1 min`  |
| **Throttling**       | _(History-capable connectors only)_ Default throttling settings inherited by items in the group.                                             | `3600, 200, 0` |
| **Caching strategy** | _(IoT-family connectors only)_ Default caching strategy inherited by items synced with the group. See [Caching Strategy](#caching-strategy). | `On change`    |

Items assigned to a group inherit its scan mode. For history-capable connectors, items also inherit
the group's throttling settings by default (Max read interval, Read delay, Start time offset, End time offset,
Recovery strategy), but each item can override them individually by disabling **Sync with group**.

Items that are **not assigned to any group** define their own scan mode directly on the item.

Groups also matter beyond scheduling: on the North side, a transformer can be assigned at the group
level, so every item in the group is transformed the same way without configuring each item
individually. This applies regardless of whether the South connector is history-capable.

:::note Execution model for SQL and REST connectors
For SQL-based and REST connectors, items within the same group are still fetched **one at a time**
sequentially. The group provides a shared schedule and default throttling settings, but each item
runs its own independent query.
:::

### Group Actions {#group-actions}

Groups can be created, edited, and deleted directly from the item edit form or from the group dropdown
in the item list. Deleting a group does not delete its items — they become unassigned.

---

## Concurrent Execution {#concurrent-execution}

By default, a South connector processes one item (or item group) at a time: even if several scan modes
fire at once, only a single query runs at any given moment, and the rest wait their turn.

If a scan mode fires again while the item or group it targets is still running — or already waiting in
line — from a previous tick, that new run is skipped rather than piling up. A warning is logged when this
happens, throttled to once per hour per item/group, so a scan mode configured too aggressively for the
current workload doesn't flood the logs while still letting you know it's happening.

Some connector types can safely run more than one query at a time, depending on how their underlying
connection model behaves, and expose this as a **Max parallel queries** setting in
their own configuration — see that connector's documentation (e.g. [OPC UA](./opcua.mdx#parallel-queries))
for details. For every other connector type, execution stays fully sequential and isn't configurable.

---

## Items {#items}

Items retrieve data as files or JSON payloads. Each item has the following fields:

| Setting               | Description                                                                                                                                 | Example Value           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Name**              | Unique reference used by North connectors and transformers to identify this data point.                                                     | `Temperature_Sensor1`   |
| **Group**             | The group this item belongs to. Leave empty for a standalone item with its own scan mode.                                                   | `Group A`               |
| **Scan mode**         | Schedule that determines when OIBus collects data. Only shown when the item has no group (otherwise inherited from the group).              | `Every 1 min`           |
| **Enabled**           | Whether the item is active.                                                                                                                 | Enabled/Disabled        |
| **Sync with group**   | _(History-capable connectors only)_ When enabled, throttling settings are inherited from the group.                                         | Enabled/Disabled        |
| **Max read interval** | _(History-capable connectors)_ Maximum sub-query duration in seconds.                                                                       | `3600`                  |
| **Read delay**        | _(History-capable connectors)_ Pause in milliseconds between consecutive sub-queries.                                                       | `200`                   |
| **Start time offset** | _(History-capable connectors)_ Milliseconds added to `@StartTime`. Negative values move it earlier to capture late-arriving data.           | `-60000`                |
| **End time offset**   | _(History-capable connectors)_ Milliseconds added to `@EndTime`. Negative values pull it earlier.                                           | `0`                     |
| **Recovery strategy** | _(History-capable connectors)_ Order in which a backlog of unqueried sub-intervals is caught up: oldest-first (default) or newest-first.    | `From oldest to newest` |
| **Caching strategy**  | _(IoT-family connectors only)_ Filters which collected values are actually cached and forwarded. See [Caching Strategy](#caching-strategy). | `On change`             |
| **Specific settings** | Varies by connector type — see each connector's documentation.                                                                              | —                       |

> For guidance on sizing **Max read interval**, **Read delay**, **Start time offset**, and **End time offset**
> — with worked examples for large backlogs and sources that don't commit all items at once — see
> [Tuning South History Call Settings](../advanced/history-query-timing.md).

### Item Actions {#item-actions}

- **Disable/Enable**: Toggle from the item edit form or directly from the connector's display page.
- **Test**: Verify item settings and preview results from the create/edit modal. You can also run the
  raw result through one of the item's North transformers to preview the transformed output — see
  [Testing a Transformer Against a Real South Item](../engine/transformers.mdx#testing-a-transformer-against-a-real-south-item).
  > **Tip**: Test the connection settings before testing individual items.
- **View last value** (🔍): Opens a read-only panel showing the item's last retrieval state. See
  [Inspecting the last retrieved value](#inspecting-the-last-retrieved-value) for details.
- **Move to group**: Select multiple items and use the mass-action menu to reassign them to a group at once.

### Import/Export Items {#importexport-items}

- **Export**: Download all items as a CSV. Columns include `name`, `enabled`, `scanMode`, `group`,
  `syncWithGroup`, `maxReadInterval`, `readDelay`, `startTimeOffset`, `endTimeOffset`, `recoveryStrategy`, and
  connector-specific `settings_*` columns.
- **Import**: Upload a CSV to create or update items in bulk. Export an existing list to get a valid
  template with the correct column names.
  > **Note**: The system validates for duplicates and correct formatting before applying the import.

---

## Caching Strategy {#caching-strategy}

For **IoT-family connectors** (OPC UA, Modbus, ADS, OPC Classic, S7, MQTT, BACnet/IP), each item can filter which
collected values are actually cached and forwarded to North connectors, instead of caching every value
read or received. This reduces cache size and North connector load for stable or slowly-changing points.

| Setting                        | Description                                                                                                                                                                                                                                                                                                      | Example Value |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Caching strategy**           | `All values` (default): cache every value. `On change`: cache only when the value differs from the last cached one. `Threshold`: cache only when the value moves by more than a configured amount. When left unset on an item synced with a group, the item inherits the group's caching strategy.               | `On change`   |
| **Threshold type**             | _(Threshold strategy only)_ `Absolute`: compare the raw numeric difference. `Percentage`: compare the difference as a percentage of a configured range.                                                                                                                                                          | `Percentage`  |
| **Threshold**                  | _(Threshold strategy only)_ The minimum change required to cache a new value — interpreted as an absolute difference or a percentage of the range, depending on **Threshold type**.                                                                                                                              | `5`           |
| **Range low** / **Range high** | _(Threshold strategy, percentage type only)_ The expected lower/upper bound of the value, used to compute the percentage span the threshold is measured against.                                                                                                                                                 | `0` / `100`   |
| **Max caching interval**       | _(Not shown for "All values")_ Optional heartbeat, in milliseconds. Even if a value doesn't qualify under **On change** or **Threshold**, it is still cached once this much time has elapsed since the last cached value — so a stable point still produces periodic proof-of-life data. Leave empty to disable. | `3600000`     |

Unlike scheduling settings, **Threshold type**, **Threshold**, **Range low**/**Range high**, and **Max
caching interval** are always configured on the item itself — they are never inherited from a group, even
when the item's **Caching strategy** is.

:::note Not available for every connector
The **Threshold** strategy isn't offered for MQTT items, since MQTT payloads aren't guaranteed to be
numeric. **On change** compares values for deep equality instead, so it works for any payload shape.
:::

:::tip The first value is always cached
The first value collected for an item — or the first one collected again after its cached comparison
state is gone (e.g. the item was deleted and re-created) — is always cached, since there is nothing yet
to compare it against. This comparison state is persisted, so it survives OIBus restarts rather than
resetting on every reconnect.
:::

Groups can also be assigned a **Caching strategy**, which items synced with the group use by default. The
threshold-specific fields, however, are never inherited: if a group's caching strategy is **Threshold**,
each synced item must still configure its own **Threshold type**/**Threshold**/**Range** — leaving them
unset falls back to an absolute threshold of `0` (i.e. any change is cached).

---

## Max Instant Tracking {#max-instant-tracking}

History-capable South connectors track the last successfully retrieved timestamp (the _max instant_) so
that each run only fetches new data. Whether that instant is tracked per item or shared across a group
depends on how the group is actually queried:

- If the connector can batch grouped items into a single query (i.e. it is _not_ one of the SQL/REST-style
  connectors described above, which always query one item at a time) **and** the item has **Sync with
  group** enabled, the whole group shares **one** tracked instant — since the group is queried as a
  single unit, there is no meaningful per-item value to track separately.
- Otherwise (no group, sync disabled, or a SQL/REST-style connector) each item tracks its own instant
  independently, even when it belongs to a group.

:::tip Leaving a shared group keeps the tracked instant, not the cached value
When an item stops being backed by a shared group instant — its group is set to none, **Sync with
group** is turned off, or the group itself is deleted — it carries the group's _tracked instant_ over
to its own, now-independent tracking, so it resumes from there instead of re-querying a full lookback
window. The group's last cached _value_ is **not** carried over; the item's own value is simply
re-populated on its next standalone query. Moving directly from one synced group to another does not
trigger this: the item keeps consulting a shared instant throughout, just under the new group.
:::

### Behaviour when configuration changes {#behaviour-when-configuration-changes}

| Action                   | Effect on max instant                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change item's group      | An already-independent item keeps its own tracked instant. An item leaving a shared group carries that group's tracked instant over to its own tracking (see tip above). Moving between two synced groups keeps using a shared instant throughout. |
| Change group's scan mode | Tracked instant(s) — per-item or shared — are preserved under the new scan mode.                                                                                                                                                                   |
| Delete a group           | Items become unassigned. An item that was independent keeps its own tracked instant; an item that was synced with the group carries its shared tracked instant over to its own tracking.                                                           |
| Delete an item           | Its own tracked instant is removed; a shared group instant is unaffected as long as other items remain in the group.                                                                                                                               |
| Delete the connector     | All items, groups, and tracked instants are removed.                                                                                                                                                                                               |

:::warning Data gaps and duplicates when changing throttling settings
If you change the Max read interval, Start time offset, or End time offset on a group or item, the next query
will use the new parameters from the current tracked instant. A significantly different offset can cause small
gaps or duplicates at the boundary.
:::

### Inspecting the last retrieved value {#inspecting-the-last-retrieved-value}

Click the **🔍** icon on any item row to open the **Last retrieved value** panel. It shows:

| Setting             | Description                                                                                                                                                                                                 | Example Value                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Item name**       | Name of the item.                                                                                                                                                                                           | `Temperature_Sensor1`         |
| **Group**           | Group this item belongs to, if any.                                                                                                                                                                         | `Group A`                     |
| **Query time**      | Timestamp of the last query execution for this item.                                                                                                                                                        | `2024-01-15T10:30:00.000Z`    |
| **Tracked instant** | The _max instant_ stored for this item — used as `@StartTime` in the next query. Empty if no query has run yet.                                                                                             | `2024-01-15T10:29:55.000Z`    |
| **Value**           | The last cached result. For file-based connectors: a list of filenames and modification times. For history connectors: the raw JSON payload of the last sub-query. Empty if no data has been retrieved yet. | `[{"file": "data.csv", ...}]` |

This panel is useful for:

- Verifying that a new item has started collecting data (check that **Tracked instant** is populated).
- Diagnosing data gaps — compare the tracked instant against the current time to see how far behind an item is.
- Confirming the exact file or record that was last seen by file-based connectors.

---

## Configuration Workflows {#configuration-workflows}

Rather than creating and maintaining items by hand, a **Configuration Workflow** browses or queries a data source,
decides which of what it finds is worth acting on, and either creates/updates items from it or forwards it to
OIAnalytics — run once on demand, or on a recurring schedule like any other collection.

Each workflow belongs to one South connector and runs in exactly one of two mutually exclusive modes, picked when the
workflow is created:

- **Create/update items locally** — the workflow owns whatever items its own discovery creates, updating them on
  later runs and disabling (never deleting) ones no longer discovered.
- **Push to OIAnalytics** — every run forwards the raw eligible records to OIAnalytics as-is, with no field mapping,
  no local item, and no diffing against a previous run. Can be picked and saved even before OIBus is
  [registered with OIAnalytics](../installation/oianalytics.mdx) — a warning is shown (and, on each run, logged) that
  nothing will actually be pushed until then. This is the only mode available for SQL-family connectors (see [Mode:
  Local vs Remote](#mode-local-vs-remote)).

### Opening the Workflow List {#opening-the-workflow-list}

On a South connector's page, click **Manage sync configuration** (next to **Manage groups**) to open the list of
workflows for that connector, then use the **+** button to create one. Each row in the list also exposes:

| Action           | Description                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Run now** (▶)  | Trigger a real run immediately — see [Running a Workflow](#running-a-workflow).                                       |
| **Preview** (👁) | Dry-run the workflow and inspect what it would do, without writing anything.                                          |
| **Run history**  | Past runs for this workflow, with their status and counts — see [Run History](#run-history).                         |
| **Edit** (✏️)    | Open the workflow for editing.                                                                                        |
| **Duplicate**    | Open the create form pre-filled with this workflow's settings (name suffixed `-copy`), saved as an independent copy.  |
| **Delete**       | Remove the workflow. Items and point metadata it already produced are **not** deleted.                                |

### Discovery Scope {#discovery-scope}

What a workflow (re-)browses or queries depends on the South connector's type:

| Connector family                                     | Discovery scope                                                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tree-based** (OPC UA, Folder Scanner)                | Click **Explore** to pick a root node to browse from, using the same interactive tree browser as the connector's own standalone Explore action. Leave it unset to browse the entire data source. |
| **SQL-family** (MSSQL, MySQL, PostgreSQL, Oracle, SQLite) | A dedicated, syntax-highlighted SQL editor for a metadata query, independent of any item's own query — each row it returns becomes one discovered record.                          |
| Any other connector type                               | Discovery isn't supported yet; the section shows a short message instead of a scope editor.                                                                                        |

For SQL-family connectors, use **Test query** to run the query immediately and inspect its raw rows (as a table or
JSON) before saving the workflow — the same round-trip a real run would make, just without acting on the result.
SQLite additionally shows a read-only reference tree of tables and columns above the editor, to browse the schema
while writing the query.

### Workflow Settings {#workflow-settings}

| Setting                | Description                                                                                                                                   | Example Value              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Name**                | Unique label for this workflow within the South connector.                                                                                    | `Reactor OPC-UA discovery` |
| **Schedule**            | Scan mode driving scheduled runs. Leave as **Manual only** to run this workflow exclusively via **Run now**.                                  | `Every 1 hour`              |
| **Mode**                | **Create/update items locally** or **Push to OIAnalytics** — see [below](#mode-local-vs-remote). Fixed to Push to OIAnalytics, and hidden, for SQL-family connectors. | `Create/update items locally` |
| **Identity key fields** | Create/update items locally only. One or more discovered-record field names whose combined value uniquely identifies a record — see [below](#identity-key-fields). | `nodeId`                    |
| **Eligibility filter**  | Conditions a discovered record must all satisfy to be acted on — see [below](#eligibility-filter).                                            | `type equals Variable`     |
| **Enabled**             | Whether scheduled runs fire at all. **Run now** still works while disabled.                                                                   | Enabled/Disabled           |

### Identity Key Fields {#identity-key-fields}

**Identity key fields** name the discovered-record field(s) (e.g. `nodeId` for OPC UA, a `column_name` returned by a
metadata query for SQL) whose combined value uniquely identifies a record. They are only shown, and at least one is
required, in **Create/update items locally** mode:

- A local workflow re-discovers its data source on every run, so it needs a way to recognize "the same" record from
  one run to the next — otherwise every run would look like an all-new set of records. Matched against the previous
  run, a record is new, changed, or unchanged, and a previously-seen key that no longer comes back is treated as
  missing (see [Running a Workflow](#running-a-workflow)). If two records of the same run share a key, the later one
  wins.
- **Push to OIAnalytics** never compares against a previous run, so it has no identity key fields at all: every
  eligible record is forwarded as-is, and correlating records across runs is left to OIAnalytics.

### Eligibility Filter {#eligibility-filter}

Conditions a discovered record must **all** satisfy (logical AND) to be considered at all — leave it empty to make
every discovered record eligible. Each condition has:

| Setting      | Description                                                                                         | Example Value |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------------- |
| **Field**    | A key of the discovered record to test.                                                                | `type`         |
| **Operator** | `equals`, `not equals`, `contains`, `matches` (regex), `exists`, `greater than`, `less than`.           | `equals`       |
| **Value**    | The value to compare against — not used for `exists`.                                                  | `Variable`     |

Use the pencil/trash icons on a condition to edit or remove it, or the fields below the table to add a new one.

### Mode: Local vs Remote {#mode-local-vs-remote}

Pick **Create/update items locally** or **Push to OIAnalytics** — the two are mutually exclusive, and switching
between them clears whatever was configured for the other.

**Create/update items locally** has the workflow create or update its own items from what it discovers. Every field
this South connector's items support is listed (the connector-specific settings, plus the schedule/group fields
every item has), and each can be mapped to:

- nothing (**Not mapped**) — the item falls back to its own default for that field,
- a fixed constant (a dropdown for boolean/choice/schedule/group fields, free text otherwise), or
- a `{{field}}` expression pulling from the discovered record — see [Mapping Expressions](#mapping-expressions).

A field badged **Required** must resolve to something once every other currently-visible field is accounted for —
saving is blocked otherwise. A field badged **Controls visibility** gates whether some other field is even shown,
so it can only be mapped to a constant (its value must be knowable while editing, not resolved per record at run
time) — the same restriction applies to the schedule and group fields themselves, and to every history-specific
field (max read interval, read delay, the time offsets, recovery strategy, sync with group). The **Group** field
defaults to **None** (self-scoped item) and lets you create, edit, or delete groups inline, exactly like the item
edit form's own group dropdown; picking a group is exempt from the scan-mode field's own **Required** badge, since
the item then inherits the group's schedule instead.

**Push to OIAnalytics** forwards every run's raw eligible records to OIAnalytics as-is — no field mapping, no local
item, and no per-record decision beyond the eligibility filter itself. Saving and running are never blocked by
registration status, but a run's push only actually happens once OIBus is
[registered with OIAnalytics](../installation/oianalytics.mdx) — while unregistered, a warning is shown when editing
the workflow, and each run that would have pushed logs a warning and completes with nothing sent instead.

:::note Fixed to Push to OIAnalytics for SQL-family connectors
For a SQL-family connector, one item is one free-form query, and a query can return several distinct points in a
single pass — so item and point aren't the same thing there, and a workflow never creates or updates items for
these connectors. The mode picker is hidden and locked to **Push to OIAnalytics**.
:::

### Mapping Expressions {#mapping-expressions}

Item field mapping (local mode only) uses a `{{field}}` placeholder syntax:

- A value that is **exactly** one placeholder (e.g. `{{nodeId}}`) resolves to that field's raw value, preserving
  its type — a numeric discovered field lands on a numeric setting untouched, not stringified.
- A placeholder embedded in other text (e.g. `Sensor {{nodeId}}`) is string interpolation instead — the result is
  always a string.
- A field missing from the discovered record resolves to an empty value rather than failing the run.

### Running a Workflow {#running-a-workflow}

A run always starts with **Retrieve** (discover the data source, exactly as the discovery scope defines) and
**Decide** (keep only eligible records), then **Act** differently depending on the workflow's mode:

- **Create/update items locally** diffs the eligible records by identity key against the previous run: create/update
  an item for anything new, changed, or reactivated; skip anything unchanged; disable — never delete — the item for
  anything no longer discovered, with the reason recorded as "Configuration workflow no longer discovers this
  entry".
- **Push to OIAnalytics** does neither — it never compares against a previous run, so nothing is ever created,
  updated, or disabled. The eligible records are simply forwarded, as-is, to OIAnalytics as one message, once per
  run.

:::tip Run now works even on a disabled connector or item
Building and testing a workflow shouldn't require switching the connector on first — **Run now** works the same
way the standalone Explore feature already does. A **scheduled** run, however, is silently skipped if the South
connector itself is disabled.
:::

Use **Preview** to see what a run would do without doing it — the same discovery and eligibility filtering as a
real run, without writing anything. For a local workflow, each record is classified as **New**, **Changed**,
**Unchanged**, **Reactivated**, or **Missing**, alongside the raw discovered/previous metadata; for a remote
workflow, it's simply the raw eligible records that would be sent, exactly as discovered. Discovery is a real
round-trip to the data source either way, so previewing a large source costs what running it for real costs, minus
the writes.

### Run History {#run-history}

Every run — manual or scheduled, whether it succeeds or fails — is recorded. The **Run history** page (reachable
from the workflow list) opens with a search form for narrowing the list down, always shown in full (no need to
expand anything first):

- **Started after / Started before** — a date range on when the run started.
- **Status** and **Trigger type** — clickable filter chips (click again to remove one, or use **Clear** to remove
  them all). Each status chip carries its own icon as well as its color (a spinner for Running, a check for
  Completed, a cross for Errored), so the table's own status badges stay distinguishable without relying on color
  alone.

The table itself shows, per run:

| Column                    | Description                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Status**                 | `Running`, `Completed`, or `Errored`.                                                             |
| **Trigger type**           | `Manual` (via Run now) or `Scheduled`.                                                            |
| **Started/Completed at**   | When the run started, and when it finished (if it has).                                          |
| **Triggered by**           | The name of the user who clicked Run now; empty for a scheduled run.                              |
| **Discovered**             | How many records this run's discovery step found in total, before eligibility filtering.         |
| **Error**                  | The failure message, if the run errored — shown as **Ø** when there wasn't one.                   |

The table deliberately shows only the discovered count - everything else the run decided or did (Eligible /
Created / Updated / Disabled / Pushed, plus the full discovered payload itself) lives one click away, behind the
**View payload** (👁) action on a row. It opens a larger modal: for a local workflow, every record it decided on,
classified exactly like **Preview** does (**New**, **Changed**, **Unchanged**, **Reactivated**, **Missing**) with
the classification leading on the left and the full JSON payload given the rest of the modal's width; for a remote
workflow, the raw records it forwarded to OIAnalytics; and — for either mode — the created/updated/disabled/pushed
counts themselves. This is the same data the run itself acted on, persisted at the time it ran - not a live
re-query - so it stays accurate even if the data source has since changed. Unavailable while a run is still
`Running`.
