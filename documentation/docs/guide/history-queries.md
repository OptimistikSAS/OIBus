---
sidebar_position: 6
---

# History Queries

History queries let you retrieve data from a past time range using the same South and North connector
infrastructure as real-time streaming. They are useful for back-filling data from before your live
setup was active, or for re-exporting a specific period.

## Compatible South Connectors

Only South connectors with historian capabilities support history queries:

| Connector          |
| ------------------ |
| [MSSQL](./south-connectors/mssql.mdx) |
| [MySQL® / MariaDB™](./south-connectors/mysql.mdx) |
| [ODBC](./south-connectors/odbc.mdx) |
| [OIAnalytics®](./south-connectors/oianalytics.mdx) |
| [OLEDB](./south-connectors/oledb.mdx) |
| [OPC Classic™ (HDA mode)](./south-connectors/opc.mdx) |
| [OPC UA™ (HA mode)](./south-connectors/opcua.mdx) |
| [Oracle Database™](./south-connectors/oracle.mdx) |
| [OSIsoft PI System™](./south-connectors/osisoft-pi.mdx) |
| [PostgreSQL](./south-connectors/postgresql.mdx) |
| [REST](./south-connectors/rest.mdx) |
| [SQLite™](./south-connectors/sqlite.mdx) |

## Create a History Query

From the **History** page, click **+** and choose:

- **New connectors** — configure a dedicated South and North connector for this query.
- **Existing connectors** — all items from the selected South connector are copied into the history query.

## Settings

### General

| Setting         | Description                                      | Example Value |
| --------------- | ------------------------------------------------ | ------------- |
| **Name**        | Unique label for the history query.              | `Backfill Jan 2024` |
| **Description** | Optional context for the query.                  | `Re-export after outage` |

### Time Range

| Setting               | Description                                                                                    | Example Value |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------- |
| **Start time**        | Beginning of the historical period to retrieve.                                                | `2024-01-01T00:00:00.000Z` |
| **End time**          | End of the historical period to retrieve.                                                      | `2024-02-01T00:00:00.000Z` |
| **Max read interval** | Maximum sub-query duration in seconds. The full range is split into chunks of this size.       | `3600`        |
| **Read delay**        | Pause in milliseconds between consecutive sub-queries, to avoid overloading the source system. | `200`         |

:::caution SQL connectors
For SQL-based connectors, your query **must** include both time variables:

```sql
SELECT * FROM sensor_data
WHERE timestamp > @StartTime
AND timestamp <= @EndTime
```

:::

### South and North Configuration

A history query embeds a full South connector (type, settings, items) and a full North connector
(type, settings, transformers, caching). These are configured the same way as their live counterparts.

## Execution Controls

| Control          | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| **Start**        | Begin the query from the current tracked position (or from Start time if never run). |
| **Pause**        | Suspend execution. Progress is preserved — the query resumes from where it stopped. |
| **Resume**       | Continue a paused query from its last tracked position.                  |
| **Restart**      | Re-run a finished or errored query from the beginning.                   |
| **Reset cache**  | Clear all cached progress and force the next run to restart from Start time. |

Controls are available from the display page, the editing page, and the history query list.

## Monitoring

The display page shows real-time metrics for both the South and North sides of the query:

**South (retrieval) metrics:**
- Interval progress — current interval number out of total intervals
- Number of values and files retrieved
- Last value retrieved (point ID, timestamp, data)
- Last file retrieved
- Last run start time and duration

**North (transmission) metrics:**
- Cache size — current, total cached, total sent
- Error size — current, total errored
- Archive size — current, total archived
- Last content sent
- Last run start time and duration

## Automatic Recovery

The query tracks the last successfully retrieved timestamp so it can resume after a failure or restart
without re-fetching already-retrieved data. Progress is preserved across OIBus restarts.

:::caution Resetting progress
Using **Reset cache** clears all tracked progress. The next run will start over from the original
**Start time**, which may result in duplicate data being sent to the North connector.
:::
