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
| **Status**      | Enable/disable the connector from the list or its display page.               | Enabled/Disabled      |

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

An item reads one data point, query or file set from the data source. Items are listed on the connector's page,
where they can be created, edited, copied, enabled/disabled, deleted, moved to a group, imported and exported.
Instead of creating them one by one, items can also be [added from the Explore modal](#exploring-the-data-source)
or kept up to date by an [items synchronisation](#items-synchronisation).

### Creating and Editing an Item {#creating-and-editing-an-item}

The item modal walks through four steps, shown in a steps bar at its top. The settings come first, so that they can
be tested before the item is named and scheduled, and the North connectors its data is sent to come once its group is
chosen:

| Step                | Content                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settings**        | The connector's own item settings (see each connector's page), with the [test panel](#testing-an-item) right below them, to try the settings as they are edited.             |
| **Name & schedule** | Name, **Status** (enabled or disabled), group and schedule, then the **History settings** (history-capable connectors) and the **Caching** settings (IoT-family connectors). |
| **North**           | The North connectors the data of the item is sent to, and the transformer it goes through — see [Where the Data of an Item Is Sent](#where-the-data-of-an-item-is-sent).     |
| **Review & save**   | A read-only summary of the whole item: general, history and caching settings, its connector settings, then the transformers to attach to North connectors.                   |

**Next** only moves on once the current step is valid. A new item is saved from the last step; an item being edited
or copied can be saved from any step. When a save fails on an invalid field, the modal opens the first step that has
an error, and every step with an error is flagged in the steps bar.

To create several similar items in a row, use **Save & add another** (**OK & add another** on the connector's
create/edit page): the item is saved, and the modal opens again for the next one, starting with the same group,
schedule and history settings.

On the connector's create/edit page, items (like groups and items synchronisations) are kept in the page and saved
together with the connector, hence the **OK** button instead of **Save**.

### Item Fields {#item-fields}

| Setting               | Step            | Description                                                                                                                                 | Example Value           |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Name**              | Name & schedule | Unique reference used by North connectors and transformers to identify this data point.                                                     | `Temperature_Sensor1`   |
| **Group**             | Name & schedule | The group this item belongs to. Leave on **None** for a standalone item with its own schedule.                                              | `Group A`               |
| **Schedule**          | Name & schedule | Scan mode that determines when OIBus collects data. Only shown when the item has no group (the group's schedule is shown otherwise).        | `Every 1 min`           |
| **Status**            | Name & schedule | Whether the item is active.                                                                                                                 | Enabled/Disabled        |
| **Sync with group**   | Name & schedule | _(History-capable connectors, grouped items)_ When enabled, the history settings below are inherited from the group.                        | Enabled/Disabled        |
| **Max read interval** | Name & schedule | _(History-capable connectors)_ Maximum sub-query duration in seconds.                                                                       | `3600`                  |
| **Read delay**        | Name & schedule | _(History-capable connectors)_ Pause in milliseconds between consecutive sub-queries.                                                       | `200`                   |
| **Start time offset** | Name & schedule | _(History-capable connectors)_ Milliseconds added to `@StartTime`. Negative values move it earlier to capture late-arriving data.           | `-60000`                |
| **End time offset**   | Name & schedule | _(History-capable connectors)_ Milliseconds added to `@EndTime`. Negative values pull it earlier.                                           | `0`                     |
| **Recovery strategy** | Name & schedule | _(History-capable connectors)_ Order in which a backlog of unqueried sub-intervals is caught up: oldest-first (default) or newest-first.    | `From oldest to newest` |
| **Caching strategy**  | Name & schedule | _(IoT-family connectors only)_ Filters which collected values are actually cached and forwarded. See [Caching Strategy](#caching-strategy). | `On change`             |
| **Specific settings** | Settings        | Varies by connector type — see each connector's documentation.                                                                              | —                       |

> For guidance on sizing **Max read interval**, **Read delay**, **Start time offset**, and **End time offset**
> — with worked examples for large backlogs and sources that don't commit all items at once — see
> [Advanced tuning of History Connectors](../advanced/history-query-timing.md).

### Testing an Item {#testing-an-item}

The **Settings** step holds the test panel, so the item's settings can be changed and tested again without leaving
the step. **Run test** queries the data source with the settings as currently edited — saved or not — and shows the
raw result. For history-capable connectors, **Query data from** / **Query data until** set the time range of the
test query.

The test of the **Settings** step shows the raw result only. To preview what a North connector receives, test the item
from the [**North** step](#where-the-data-of-an-item-is-sent), through the transformer of that North connector — or see
[Testing a Transformer Against a Real South Item](../engine/transformers.mdx#testing-a-transformer-against-a-real-south-item).

> **Tip**: Use **Test settings** on the connector first, to check the connection before testing individual items.

### Where the Data of an Item Is Sent {#where-the-data-of-an-item-is-sent}

The data of an item only reaches a North connector through a transformer attached to it for the item's south. The
**North** step of the item modal, and the **North** section of the item view, list every North connector with the
transformer the data of the item goes through, and what this transformer is attached to: the item itself, its group,
or all the items of the south. A transformer attached to the item takes over one of its group, which takes over one of
the whole south. The North connectors that don't get the data of the item show **Not sent**.

Select a North connector to see its transformer and to test the item through it: the test panel runs the item and
shows both the raw result and the transformer output.

**Attach a transformer** (**Send through another transformer** when the item is already sent through the transformer
of its group or of its south) attaches a new transformer to the selected North connector: choose what it applies to —
**This item**, **Its group** (when the item has one) or **All the items of the south** —, then the transformer and its
options. Only the scopes that take over the current transformer are offered: a transformer already attached to the item
itself is changed from the [transformers of the North connector](../north-connectors/common-settings.md). For a group
or the whole south, the step tells how many other items the transformer would send too.

The transformers to attach are listed in the **Review & save** step, and saved with the item, in one operation: if the
item can't be saved, none of them is attached. On the connector's create/edit page, they are saved with the connector.

### Item Actions {#item-actions}

- **Disable/Enable**: Toggle from the item modal or directly from the connector's display page. Several selected items
  can be enabled or disabled at once.
- **Copy**: Opens the item modal pre-filled with the item's settings, to create a similar item.
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

## Exploring the Data Source {#exploring-the-data-source}

Connectors that can browse their data source show an **Explore** button in the items section of their page (**Explore and
sync** for the connectors with [discovery](#items-synchronisation), which also keep items in sync: see
[Explore and Sync](#explore-and-sync)). It opens the **Explore data source** modal: a tree of what the data source
holds, loaded level by level as nodes are expanded.

| Connector                                                 | What the tree shows                                                                 | Actions on selected nodes             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| [OPC UA](./opcua.mdx#node-metadata)                       | The server's address space, with node metadata (node ID, type, description, unit…)  | **Add as items**, **Keep in sync…**   |
| [BACnet/IP](./bacnet.mdx#discovering-devices-and-objects) | Devices, then the objects of each device                                            | **Add as items**, **Keep in sync…**   |
| MSSQL, MySQL, PostgreSQL, Oracle, SQLite                  | Tables (with column and row counts where available), then the columns of each table | **Add in an item**, **Metadata sync** |
| [Folder Scanner](./folder-scanner.mdx)                    | Folders and files of the input folder, with size and dates                          | — (browsing only)                     |

Click a node to show its details (the metadata the data source gives for it) in a side panel, each value with a copy
button. Explore uses the settings as currently edited, so it works from the connector's create/edit page before the
connector is saved.

:::tip Explore and the connector's own connection
A running connector with the same settings is explored through its open connection, rather than a second one —
servers that cap the number of sessions per client (e.g. OPC UA) don't refuse it. A disabled or unsaved connector is
explored through a temporary instance that is released when the modal is closed, so exploring never starts the
connector's own collection.
:::

### Selecting Nodes {#selecting-nodes}

For connectors with actions on selected nodes, every node has a checkbox. A node that has children also offers
**Select all the sub-nodes**, which loads and checks its direct children at once (and unchecks them when they are all
checked already). The number of selected nodes is shown at the bottom of the modal, next to the actions. Choosing an
action moves on to the next step of the same modal; the steps are listed under its title, and the **Explore** step stays
one click away to change the selected nodes or the action:

- **Add as items** creates items once from the selected nodes — see [below](#adding-explored-nodes-as-items).
- **Keep in sync…** creates an [items synchronisation](#items-synchronisation) that discovers from the selected
  nodes: the steps of the synchronisation wizard follow, with the nodes as its discovery scope, and the connector's
  [discovery defaults](#discovery-defaults). Unlike **Add as items**, the synchronisation keeps the items up to date
  on each run: new points get an item, and the items of points that disappeared are disabled.

What a selected node stands for depends on its kind: a point (an OPC UA variable, a BACnet object, a SQL column)
stands for itself, any other node (a folder, a device, a table) for everything under it.

### Adding Explored Nodes as Items {#adding-explored-nodes-as-items}

**Add as items** moves on to the **Add as items** step of the Explore modal, to review the items before they are
created. It has the **Item field mapping** of an [items synchronisation](#items-synchronisation), filled in from the
connector's [discovery defaults](#discovery-defaults), in the sections of the item modal: **Name & schedule** (name,
enabled, group, schedule and, when the connector supports history, the history settings) and the settings of the
connector. As in the item modal, picking a group replaces the schedule with the one of the group and shows
**Sync with group** (on by default), and the history settings are hidden while the item is synced with its group. The
items are enabled, and the history settings start with the values of the item modal (max read interval 3600 s, read delay 200 ms, oldest
recovery strategy, offsets 0). Each field is a constant or an expression of the discovered record: the fields of the records of the connector are listed
above the mapping (the same list is in the Items step of a synchronisation), and clicking one puts `{{field}}` where you
were typing — or copies it when you were not typing in a field that takes an expression. Under it, the
points under the selected nodes are discovered with this mapping and listed; they are discovered again a moment after
the mapping changes (or with **Refresh preview**), and the items can't be added until they are:

- Each row is one item, with its name (editable) and its main settings. Uncheck a row to leave it out, or use the
  header checkbox to select all or none.
- A row whose settings are already read by an existing item is flagged **Already read by** _that item_, and left
  unchecked. A name already used by another item or row is flagged **Name already used**.

**Add items** creates the checked rows. Items are named and set up from the connector's
[discovery defaults](#discovery-defaults); every item setting left out of them gets its usual default value, as in the
item modal.

#### SQL Tables in an Item {#sql-tables-as-items}

For the SQL connectors, **Add in an item** gives **one item** for everything checked: its query is written from the
tables and columns checked, and the item modal opens with it, to complete (name, schedule, group…) and save. Nothing is
created before you save.

- A selected table reads all its columns (`SELECT *`); selected columns read only those columns.
- OIBus picks a **date/time column** to track the table: among the date/time columns of the table, it prefers a
  usual name (`timestamp`, `time`, `date`, `datetime`, or ending with `_at`, `_time`, `_date`, `timestamp`), else the
  first one. That column is always read, even if not selected, and the query only reads the rows of the time range of
  each run. For example, with the `tag` and `value` columns of an MSSQL table selected:

  ```sql
  SELECT [timestamp], [tag], [value] FROM [dbo].[measures] WHERE [timestamp] > @StartTime AND [timestamp] <= @EndTime
  ```

  The item's **Track instant** is enabled on that column, with the date/time type matching its SQL type, so each run
  starts where the last one stopped.

- A table without any date/time column is read whole on each run, untracked: review its query before enabling it.
- **Several tables** are read by one query that joins them, on a column they share (a primary key first) — for example
  `FROM [dbo].[measures] [measures] INNER JOIN [dbo].[tags] [tags] ON [measures].[tag_id] = [tags].[tag_id]`. Two tables
  with no column in common are joined on a condition left to complete (`ON 1 = 1 /* join condition to complete */`): it
  is a suggestion, to check and finish in the item. A column whose name an earlier table already has is renamed after its
  table (`tags_value`), and the time range is the one of the first table that has a date/time column.

Table and column names are quoted in the connector's own SQL dialect. The generated query is a starting point: edit
the item to filter rows or rename columns.

While writing the query of a SQL item, **Browse tables** (in the Settings step of the item modal) opens the database
browser to look up a table or a column, without leaving the item. Each table lists its `SELECT` query among its details,
with a copy button, as the names and types of its columns.

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

## Items Synchronisation {#items-synchronisation}

Rather than creating and maintaining items by hand, an **items synchronisation** browses or queries the data source,
keeps what is worth acting on, and either creates/updates items from it or forwards it to OIAnalytics — run once on
demand, or on a schedule like any other collection.

Each synchronisation belongs to one South connector and runs in one of two modes:

- **Create/update items locally** — the synchronisation owns the items it creates, updates them on later runs, and
  disables (never deletes) the ones whose point is no longer found.
- **Push to OIAnalytics** — every run forwards the discovered records to OIAnalytics as-is, with no field mapping,
  no local item, and no comparison with a previous run. This is the only mode of the SQL connectors (see
  [Mode](#mode)).

Which connectors support it, and what they discover from:

| Connector family                                   | Discovery scope                                                                  | Modes                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| **Tree-based** (OPC UA, BACnet/IP)                 | Nodes picked in the Explore tree — or the whole data source when none is picked. | Local or Push to OIAnalytics |
| **SQL** (MSSQL, MySQL, PostgreSQL, Oracle, SQLite) | A metadata query: each row it returns is one discovered record.                  | Push to OIAnalytics only     |
| Any other connector type (Folder Scanner included) | Not supported yet: the Source step shows a short message instead.                | —                            |

:::tip Items synchronisation or Add as items?
To create items once from what the data source holds, select the nodes in the Explore modal and use
[Add as items](#adding-explored-nodes-as-items). Use an items synchronisation when the data source changes over time
(new points, removed points) and the items must follow.
:::

### Explore and Sync {#explore-and-sync}

For a connector with discovery, the **Explore and sync** button opens a home screen, in a modal of its own:

- **Explore the data source** starts the [Explore modal](#selecting-nodes): select nodes, then **Add as items** or
  **Keep in sync…**.
- The connector's synchronisations are listed under it, with their discovery scope (their nodes, the whole data source,
  or a query), schedule, mode and whether they are enabled (a dash for one with no schedule, which only runs on demand). **New synchronisation** creates one (for a SQL connector,
  from its Source step, where the query is written).
- For a SQL connector, the home offers to **Browse the database** instead, and lists **Metadata synchronisations**: the
  records of their query are pushed to OIAnalytics. In the Explore step, **Metadata sync** starts one from the tables
  checked (its query is written for you, with no time range, and the Items step is skipped since there is nothing to
  map), and **Add in an item** starts an item, see [SQL Tables in an Item](#sql-tables-as-items).

Each synchronisation of the list has these actions:

| Action          | Description                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **Run now** (▶) | Trigger a real run immediately — see [Running an Items Synchronisation](#running-an-items-synchronisation).  |
| **Past runs**   | The runs, with their status and counts — see [Run History](#run-history).                                    |
| **Edit** (✏️)   | Open the synchronisation in the wizard, on its Explore step with its nodes checked.                          |
| **Duplicate**   | Open the wizard pre-filled with this synchronisation's settings (name suffixed `-copy`), saved as a new one. |
| **Delete**      | Remove the synchronisation. The items it created and the metadata it pushed are **not** deleted.             |

In the Explore step, a row above the tree names the synchronisations that already keep nodes in sync, and the nodes
they cover are marked with the name of their synchronisation (a synchronisation of the whole data source is only named
in the row). Below the tree, the selected nodes can be added to an existing synchronisation instead of a new one
(**Keep in sync…** then goes on with that synchronisation's own settings and its nodes plus the selected ones, and saving
updates it). Unchecking nodes of a synchronisation being edited warns that the items they gave are disabled by its next
run. **Add as items** on
nodes a synchronisation already keeps in sync notes it above the mapping, since both may create the same items.

The same button is on the connector's create/edit page. There, changes are kept in the page and saved together with the
connector (like items and groups), and previews run against the connector settings as currently edited — so a
synchronisation can be tried before the connector itself is saved. **Run now** and **Past runs** are only available
from the connector's page, once it is saved.

### The Wizard {#the-wizard}

A synchronisation is created and edited in a wizard. For a tree-based connector it starts from the
[Explore step](#selecting-nodes), where its nodes are checked, then goes through four steps; a SQL connector has a
**Source** step first, for its query. The steps bar at its top shows where you are, and a click on a step opens it.

| Step                | What it sets                                                                |
| ------------------- | --------------------------------------------------------------------------- |
| **Source**          | SQL connectors only: the metadata query to discover from.                   |
| **Filter**          | Which discovered records to act on, with a preview of the matching records. |
| **Items**           | The mode, and for local mode how a record becomes an item.                  |
| **Name & schedule** | The name, when to run, and whether scheduled runs are enabled.              |
| **Review**          | A summary, what to fix before saving, and a preview of what a run would do. |

**Next** leaves the Source step once it has a query. A new synchronisation is saved from the Review step; one being
edited can be saved from any step.

#### Source {#source}

For SQL connectors, write a metadata query in the SQL editor — independent of any item's own query, each row it returns
becomes one discovered record (e.g. `SELECT tag, description, unit FROM tag_list`). Started from **Metadata sync** in the
Explore step, it is already written from the tables checked, and the synchronisation is named after them. When the connector can be explored,
its tables and columns are shown above the editor for reference. **Test query** runs the query and shows its raw rows, as
a table or JSON.

A tree-based connector has no Source step: it discovers from the nodes checked in the Explore step. A point stands for
itself, any other node (a folder, a device) for everything under it, and with no node the whole data source is
discovered. The Filter step reminds the nodes; to change them, go back to the Explore step.

#### Filter {#filter}

The **Eligibility filter** lists the conditions a discovered record must **all** satisfy (logical AND) to be acted
on — leave it empty to make every record eligible. Each condition has:

| Setting      | Description                                                                                   | Example Value |
| ------------ | --------------------------------------------------------------------------------------------- | ------------- |
| **Field**    | A field of the discovered record. The fields of the previewed records are suggested.          | `type`        |
| **Operator** | `equals`, `not equals`, `contains`, `matches (regex)`, `exists`, `greater than`, `less than`. | `equals`      |
| **Value**    | The value to compare against — not used for `exists`.                                         | `Variable`    |

Add a condition with the fields below the table; edit or remove one with its pencil and trash icons.

Opening the step discovers the data source and shows **Matching records: _eligible_ of _discovered_**, with the matching
records in a table, to see which fields they have and their values. The table is paginated, and its search box looks for
a text in the values of every field. Click **Refresh preview** after changing the conditions. Discovery is a real round trip to the data source: previewing a large source costs what a run costs,
minus the writes.

#### Items {#items-step}

The Items step lists the same matching records, with the same search and pagination, under **Discovered records**, so
the values of their fields are in front of you while you write the mapping. They are not discovered again when the
nodes and the filter are the same as in the Filter step.

##### Mode {#mode}

Pick **Create/update items locally** or **Push to OIAnalytics**. Switching between them clears what was configured
for the other.

- **Push to OIAnalytics** forwards every run's eligible records to OIAnalytics as-is. Saving and running are never
  blocked by the registration status, but the push only happens once OIBus is
  [registered with OIAnalytics](../installation/oianalytics.mdx): until then, a warning is shown in the wizard, and
  each run logs a warning and sends nothing.
- **Create/update items locally** shows the **Item field mapping** below.

:::note SQL connectors only push to OIAnalytics
For a SQL connector, one item is one free-form query, and a query can return several distinct points at once — item
and point aren't the same thing there. A synchronisation never creates or updates items for these connectors, and the
mode picker is replaced by a note. To create an item from SQL tables, use [Add in an item](#sql-tables-as-items) in the
Explore modal.
:::

##### Item Field Mapping {#item-field-mapping}

Each field of the connector's items can be mapped to:

- **Not mapped** — a new item gets the field's usual default value, as in the item modal (an updated item keeps its
  own value),
- a constant (a dropdown for yes/no, choice, schedule and group fields; free text otherwise), or
- a `{{field}}` expression taking a value from the discovered record — see
  [Mapping Expressions](#mapping-expressions).

The [identity key fields](#identity-key-fields) come first, then the mapping, in the sections of the item modal (the
same form as [Add as items](#adding-explored-nodes-as-items)): **Name & schedule** — name, enabled, group, schedule and,
when the connector supports history, the history settings — then the settings of the connector. Above the mapping, the
fields of the discovered records are listed: click one to put `{{field}}` where you are typing. Under it, **Example
item names** shows the names the first matching records would give.

As in the item modal, the **Group** dropdown defaults to **None** and lets you create, edit or delete groups. Picking a
group replaces the schedule with the one of the group and shows **Sync with group** (on by default); the history
settings are hidden while the item is synced with its group. A new mapping starts with the items enabled and the history settings of the item
modal (max read interval 3600 s, read delay 200 ms, oldest recovery strategy, offsets 0) and with the connector's
[discovery defaults](#discovery-defaults), when it has some.

A **Required** badge guides the mapping:

- **Required** — the field must be mapped for the item to be valid, given the other fields currently shown. Saving is
  blocked otherwise. The schedule is exempt once the item is mapped into a group. **Enabled** is always required: an
  item is enabled or not on purpose (it starts mapped to yes in a new mapping). Note that for a synchronisation, a mapped
  **Enabled** is applied to the items it updates too, whereas an unmapped one leaves them as they are.

The group, the schedule and every history setting (max read interval, read delay, time offsets, recovery strategy, sync with
group) take a constant only, since they can't vary from one record to the next: the other fields also take a `{{field}}`
expression.

##### Identity Key Fields {#identity-key-fields}

The **Identity key fields** name the record field(s) whose combined value identifies a record across runs — e.g. `id`
for OPC UA and BACnet. At least one is required in local mode:

- A local synchronisation discovers the data source again on every run, and matches the records against the previous
  run by this key: a record is new, changed or unchanged, and a key that no longer comes back is missing (see
  [Running an Items Synchronisation](#running-an-items-synchronisation)). If two records of the same run share a key,
  the later one wins.
- **Push to OIAnalytics** never compares runs, so it has no identity key fields: correlating records across runs is
  left to OIAnalytics.

##### Mapping Expressions {#mapping-expressions}

Item fields use a `{{field}}` placeholder syntax:

- A value that is **exactly** one placeholder (e.g. `{{nodeId}}`) takes that field's raw value, keeping its type — a
  numeric record field lands on a numeric setting untouched, not turned into text.
- A placeholder inside other text (e.g. `Sensor {{nodeId}}`) is string interpolation — the result is always text.
- A field missing from the record resolves to an empty value rather than failing the run.

##### Discovery Defaults {#discovery-defaults}

Connectors whose discovered records always have the same shape come with discovery defaults: a new synchronisation
(and [Add as items](#adding-explored-nodes-as-items)) starts with these identity key fields and this mapping, which
can then be changed.

| Connector | Identity key | Item field mapping                                                                                                                                                                                              |
| --------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPC UA    | `id`         | Name `{{path}}` (the display names from the discovery root, joined by `/`), Node ID `{{nodeId}}`, mode `HA` with the `Raw` aggregate, timestamp origin `OIBus`. See [Node Metadata](./opcua.mdx#node-metadata). |
| BACnet/IP | `id`         | Name `{{deviceName}} - {{name}}`, device address and instance, object type and instance, routing (`{{routed}}`, network number, MAC address) from the record; property `present-value`, timezone `UTC`.         |

#### Name & Schedule {#schedule}

- **Name** — unique among the connector's synchronisations.
- **Schedule** — the scan mode driving scheduled runs (the subscription is not one of them: it is the schedule of items
  only). Leave it on **Manual only** to run the synchronisation only with **Run now**.
- **Enabled** — whether scheduled runs fire. It only shows once a schedule is picked: with **Manual only**, nothing
  fires. **Run now** works even when disabled.

In local mode, a reminder states that when a point is no longer found, the item created for it is disabled.

#### Review {#review}

The Review step sums up the synchronisation (name, discovery scope, number of conditions, mode, schedule) and previews
what a run would do — opening the step runs the preview, **Refresh preview** runs it again. While something prevents it
(a missing name or query, no identity key field, a mandatory item field not mapped…), the step lists what to fix, each
with a button to the step where to fix it, and no preview runs:

- **Create/update items locally**: each record is classified against the previous run as **New**, **Changed**,
  **Unchanged**, **Reactivated** or **Missing**, with its identity key and fields. A changed record highlights the
  fields that differ, with the previous value on hover; a missing one shows the previous run's values, dimmed.
- **Push to OIAnalytics**: the records that would be pushed, exactly as discovered.

A search box above the table looks for a text in the identity key, the status and the values of the rows (in memory, over
the whole preview), and the table is paginated. **Export CSV** downloads all the previewed rows, whatever the search.
Nothing is written by a preview.

### Running an Items Synchronisation {#running-an-items-synchronisation}

A run always discovers the data source (as the discovery scope defines it) and keeps the eligible records, then acts
depending on the mode:

- **Create/update items locally** matches the eligible records by identity key against the previous run: it creates
  or updates an item for each new, changed or reactivated record, skips the unchanged ones, and disables — never
  deletes — the item of each missing record, with the reason "Configuration workflow no longer discovers this entry".
  A new item gets the usual default value of every field the mapping leaves out, where it applies.
- **Push to OIAnalytics** forwards the eligible records as-is to OIAnalytics, as one message per run. Nothing is
  created, updated or disabled.

:::tip Run now works on a disabled connector
Building and testing a synchronisation doesn't require enabling the connector first: **Run now** works on a disabled
connector, as Explore does. A **scheduled** run, however, is skipped while the South connector is disabled.
:::

### Run History {#run-history}

Every run — manual or scheduled, successful or not — is recorded. The **Run history** page, opened with **Past runs** from the list of
synchronisations, starts with a search form:

- **Started after / Started before** — a date range on when the run started.
- **Status** and **Trigger type** — filter chips (click again to remove one, or **Clear** to remove them all). Each
  status chip has its own icon as well as its color (a spinner for Running, a check for Completed, a cross for
  Errored).

The table shows, per run:

| Column                  | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| **Status**              | `Running`, `Completed`, or `Errored`.                               |
| **Trigger**             | `Manual` (Run now) or `Scheduled`.                                  |
| **Started / Completed** | When the run started, and when it finished (if it has).             |
| **Triggered by**        | The user who clicked Run now; empty for a scheduled run.            |
| **Discovered**          | How many records the run discovered, before the eligibility filter. |
| **Error**               | The failure message, if the run errored — **Ø** otherwise.          |

**View payload** (👁) on a row opens what the run did, as the Review step previews it: the records classified as
**New**, **Changed**, **Unchanged**, **Reactivated** or **Missing** (local mode) or the records pushed (Push to
OIAnalytics), with the created / updated / disabled / pushed counts and **Export CSV**. It is the data the run acted
on, stored when it ran — not a new query — so it stays accurate even if the data source has changed since.
Unavailable while the run is still `Running`.
