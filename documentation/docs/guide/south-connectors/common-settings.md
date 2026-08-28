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

| Setting        | Description                                                                                      | Example Value  |
| -------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| **Name**       | Unique label for the group within this connector.                                                | `Group A`      |
| **Scan mode**  | Schedule used to collect data for all items in the group.                                        | `Every 1 min`  |
| **Throttling** | _(History-capable connectors only)_ Default throttling settings inherited by items in the group. | `3600, 200, 0` |

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

| Setting               | Description                                                                                                                              | Example Value           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Name**              | Unique reference used by North connectors and transformers to identify this data point.                                                  | `Temperature_Sensor1`   |
| **Group**             | The group this item belongs to. Leave empty for a standalone item with its own scan mode.                                                | `Group A`               |
| **Scan mode**         | Schedule that determines when OIBus collects data. Only shown when the item has no group (otherwise inherited from the group).           | `Every 1 min`           |
| **Enabled**           | Whether the item is active.                                                                                                              | Enabled/Disabled        |
| **Sync with group**   | _(History-capable connectors only)_ When enabled, throttling settings are inherited from the group.                                      | Enabled/Disabled        |
| **Max read interval** | _(History-capable connectors)_ Maximum sub-query duration in seconds.                                                                    | `3600`                  |
| **Read delay**        | _(History-capable connectors)_ Pause in milliseconds between consecutive sub-queries.                                                    | `200`                   |
| **Start time offset** | _(History-capable connectors)_ Milliseconds added to `@StartTime`. Negative values move it earlier to capture late-arriving data.        | `-60000`                |
| **End time offset**   | _(History-capable connectors)_ Milliseconds added to `@EndTime`. Negative values pull it earlier.                                        | `0`                     |
| **Recovery strategy** | _(History-capable connectors)_ Order in which a backlog of unqueried sub-intervals is caught up: oldest-first (default) or newest-first. | `From oldest to newest` |
| **Specific settings** | Varies by connector type — see each connector's documentation.                                                                           | —                       |

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
