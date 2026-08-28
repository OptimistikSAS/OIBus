---
sidebar_position: 6
---

# History Queries

History queries let you retrieve data from a past time range using the same South and North connector
infrastructure as real-time streaming. They are useful for back-filling data from before your live
setup was active, or for re-exporting a specific period.

## Compatible South Connectors {#compatible-south-connectors}

Only South connectors with historian capabilities support history queries:

| Connector                                               |
| ------------------------------------------------------- |
| [InfluxDB](./south-connectors/influxdb.mdx)             |
| [MSSQL](./south-connectors/mssql.mdx)                   |
| [MySQL® / MariaDB™](./south-connectors/mysql.mdx)       |
| [ODBC](./south-connectors/odbc.mdx)                     |
| [OIAnalytics®](./south-connectors/oianalytics.mdx)      |
| [OLEDB](./south-connectors/oledb.mdx)                   |
| [OPC Classic™ (HDA mode)](./south-connectors/opc.mdx)   |
| [OPC UA™ (HA mode)](./south-connectors/opcua.mdx)       |
| [Oracle Database™](./south-connectors/oracle.mdx)       |
| [OSIsoft PI System™](./south-connectors/osisoft-pi.mdx) |
| [PostgreSQL](./south-connectors/postgresql.mdx)         |
| [REST](./south-connectors/rest.mdx)                     |
| [SQLite™](./south-connectors/sqlite.mdx)                |

## Create a History Query {#create-a-history-query}

From the **History** page, click **+**. The South and North sides are configured independently, each with
its own **From existing connector** switch:

- **Disabled** (default) — pick a connector type and configure it from scratch for this query.
- **Enabled** — pick an existing South or North connector. For the South side, all of its items are copied
  into the history query.

Any combination is allowed — for example, a brand-new South connector paired with an existing North connector.

You can also **duplicate** an existing history query from the history query list — this copies the full
South and North configuration, items, and transformers into a new query.

## Settings {#settings}

### General {#general}

| Setting         | Description                         | Example Value            |
| --------------- | ----------------------------------- | ------------------------ |
| **Name**        | Unique label for the history query. | `Backfill Jan 2024`      |
| **Description** | Optional context for the query.     | `Re-export after outage` |

### Time Range {#time-range}

| Setting               | Description                                                                                    | Example Value              |
| --------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- |
| **Start time**        | Beginning of the historical period to retrieve.                                                | `2024-01-01T00:00:00.000Z` |
| **End time**          | End of the historical period to retrieve.                                                      | `2024-02-01T00:00:00.000Z` |
| **Max read interval** | Maximum sub-query duration in seconds. The full range is split into chunks of this size.       | `3600`                     |
| **Read delay**        | Pause in milliseconds between consecutive sub-queries, to avoid overloading the source system. | `200`                      |

> For guidance on sizing **Max read interval** and **Read delay** — including the trade-off between them on a
> large backlog — see [Max read interval](./advanced/history-query-timing.md#max-read-interval-bounding-how-much-a-single-query-asks-for)
> and [Read delay](./advanced/history-query-timing.md#read-delay-pacing-consecutive-sub-queries) in
> [Tuning South History Call Settings](./advanced/history-query-timing.md). A history query item has no group,
> offsets, or recovery strategy, so the rest of that page doesn't apply here.

:::caution SQL connectors
For SQL-based connectors, your query **must** include both time variables:

```sql
SELECT * FROM sensor_data
WHERE timestamp > @StartTime
AND timestamp <= @EndTime
```

:::

### South and North Configuration {#south-and-north-configuration}

A history query embeds a full South connector and a full North connector. The North side (settings,
caching, transformers) is configured exactly like a live North connector. The South side's connection
settings are configured the same way too, but items are simplified: a history query item only has a
**name**, an **enabled** flag, and its type-specific settings — there is no per-item scan mode, group, or
throttling override. Every item shares the single **Time Range** settings above instead.

## Execution Controls {#execution-controls}

| Control     | Description                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start**   | Available when the query is `PENDING`. Begins the query from Start time.                                                                           |
| **Pause**   | Available when the query is `RUNNING`. Suspends execution; each item's progress is preserved.                                                      |
| **Resume**  | Available when the query is `PAUSED`. Continues from each item's last tracked position.                                                            |
| **Restart** | Available when the query is `FINISHED` or `ERRORED`. Re-runs the query from Start time — starting it in this state always resets tracked progress. |

These controls are available from the history query list and its display page.

Editing an existing history query also prompts you to reset the cache when you save. Answering **Yes**
clears all tracked progress so the next run restarts from Start time; answering **No** keeps the current
progress.

## Monitoring {#monitoring}

The display page shows real-time metrics for both the South and North sides of the query:

**South (retrieval) metrics:**

- Interval progress — current interval number out of total intervals
- Number of values and files retrieved
- Last connection time
- Last value retrieved (point ID, timestamp, data)
- Last file retrieved
- Last run start time and duration

**North (transmission) metrics:**

- Cache size — current, total cached, total sent
- Error size — current, total errored
- Archive size — current, total archived
- Last connection time
- Last content sent
- Last run start time and duration

## Automatic Recovery {#automatic-recovery}

Each item (or synced group) tracks its own last-retrieved timestamp independently, so the query can resume
after a failure or restart without re-fetching already-retrieved data. Progress is preserved across OIBus
restarts.

:::caution Resetting progress
Resetting the cache clears every item's tracked progress. The next run will start over from the original
**Start time**, which may result in duplicate data being sent to the North connector.
:::
