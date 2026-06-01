---
sidebar_position: 0
---

# Common Settings

A **South connector** fetches data from a specific source (e.g., MQTT broker, MSSQL database) and forwards it to
North caches. Each connector manages one or more **items** — the individual data points or queries to collect.
Items can optionally be organised into **groups** to share a common schedule and throttling configuration.

## Adding a South Connector

1. Navigate to the **South** page.
2. Click the **+** button.
3. Select a connector type and configure its settings.
4. Monitor or adjust settings from the connector's display page.

## General Settings

| Setting         | Description                                                                   | Example Value         |
| --------------- | ----------------------------------------------------------------------------- | --------------------- |
| **Name**        | User-friendly label for easy identification.                                  | `My MSSQL Connector`  |
| **Description** | Optional context (connection details, access rights, unique characteristics). | `Production database` |
| **Enabled**     | Enable/disable the connector from the list or its display page.               | Enabled/Disabled      |

## Specific Section

Refer to each connector's documentation for type-specific settings.

### Testing Connection

Use the **Test settings** button to verify your connection configuration.

---

## Groups

A group bundles items that share the same collection schedule. Each group has:

| Setting        | Description                                                                                      | Example Value  |
| -------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| **Name**       | Unique label for the group within this connector.                                                | `Group A`      |
| **Scan mode**  | Schedule used to collect data for all items in the group.                                        | `Every 1 min`  |
| **Throttling** | _(History-capable connectors only)_ Default throttling settings inherited by items in the group. | `3600, 200, 0` |

Items assigned to a group inherit its scan mode. For history-capable connectors, items also inherit
the group's throttling settings by default (Max read interval, Read delay, Overlap), but each item can
override them individually by disabling **Sync with group**.

Items that are **not assigned to any group** define their own scan mode directly on the item.

:::note Execution model for SQL and REST connectors
For SQL-based and REST connectors, items within the same group are still fetched **one at a time**
sequentially. The group provides a shared schedule and default throttling settings, but each item
runs its own independent query.
:::

### Group Actions

Groups can be created, edited, and deleted directly from the item edit form or from the group dropdown
in the item list. Deleting a group does not delete its items — they become unassigned.

---

## Items

Items retrieve data as files or JSON payloads. Each item has the following fields:

| Setting               | Description                                                                                                                    | Example Value         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| **Name**              | Unique reference used by North connectors and transformers to identify this data point.                                        | `Temperature_Sensor1` |
| **Group**             | The group this item belongs to. Leave empty for a standalone item with its own scan mode.                                      | `Group A`             |
| **Scan mode**         | Schedule that determines when OIBus collects data. Only shown when the item has no group (otherwise inherited from the group). | `Every 1 min`         |
| **Enabled**           | Whether the item is active.                                                                                                    | Enabled/Disabled      |
| **Sync with group**   | _(History-capable connectors only)_ When enabled, throttling settings are inherited from the group.                            | Enabled/Disabled      |
| **Max read interval** | _(History-capable connectors)_ Maximum sub-query duration in seconds.                                                          | `3600`                |
| **Read delay**        | _(History-capable connectors)_ Pause in milliseconds between consecutive sub-queries.                                          | `200`                 |
| **Overlap**           | _(History-capable connectors)_ Milliseconds subtracted from `@StartTime` to capture late-arriving data.                        | `0`                   |
| **Specific settings** | Varies by connector type — see each connector's documentation.                                                                 | —                     |

### Item Actions

- **Disable/Enable**: Toggle from the item edit form or directly from the connector's display page.
- **Test**: Verify item settings and preview results from the create/edit modal.
  > **Tip**: Test the connection settings before testing individual items.
- **View last value** (🔍): Opens a read-only panel showing the item's last retrieval state. See
  [Inspecting the last retrieved value](#inspecting-the-last-retrieved-value) for details.
- **Move to group**: Select multiple items and use the mass-action menu to reassign them to a group at once.

### Import/Export Items

- **Export**: Download all items as a CSV. Columns include `name`, `enabled`, `scanMode`, `group`,
  `syncWithGroup`, `maxReadInterval`, `readDelay`, `overlap`, and connector-specific `settings_*` columns.
- **Import**: Upload a CSV to create or update items in bulk. Export an existing list to get a valid
  template with the correct column names.
  > **Note**: The system validates for duplicates and correct formatting before applying the import.

---

## Max Instant Tracking

History-capable South connectors track the last successfully retrieved timestamp (the _max instant_) so
that each run only fetches new data. The max instant is tracked at the **item** level — each item
maintains its own independent tracking, whether it belongs to a group or not.

### Behaviour when configuration changes

| Action                   | Effect on max instant                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| Change item's group      | Item retains its own tracked instant; only throttling defaults may change. |
| Change group's scan mode | Each item's tracked instant is preserved under the new scan mode.          |
| Delete a group           | Items become unassigned; their tracked instants are preserved.             |
| Delete an item           | Its tracked instant is removed.                                            |
| Delete the connector     | All items and tracked instants are removed.                                |

:::warning Data gaps and duplicates when changing throttling settings
If you change the Max read interval or Overlap on a group or item, the next query will use the new
parameters from the current tracked instant. A significantly different overlap can cause small gaps
or duplicates at the boundary.
:::

### Inspecting the last retrieved value

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
