---
sidebar_position: 6
---

# History Queries

OIBus enables both real-time data streaming and historical data retrieval, allowing access to information from periods before your streaming setup was active.

## Create a History Query

### Setup Options

You can create history queries using:

- **New South/North connectors** specifically for historical retrieval
- **Existing South/North connectors** (all items will be copied)

:::info Compatible Connectors
Only South connectors with historian capabilities support history queries, including:

- OPC UA (HA mode)
- OPC Classic (HDA mode)
- MSSQL/SQL Server
- PostgreSQL
- Oracle
- OSIsoft PI System™
- Other temporal database connectors

:::

## History Query Main Settings

### Time Configuration

1. **Start Time**: Beginning of historical period (required)
2. **End Time**: End of historical period (required)

:::caution SQL Connectors Requirement
For SQL-based connectors, you MUST include both time variables in your queries:

```sql
SELECT * FROM sensor_data
WHERE timestamp > @StartTime
AND timestamp <= @EndTime
```

:::

## Resilience Features

### Automatic Recovery

- Tracks maximum retrieved timestamp in local cache
- Resumes from last position after connection failures
- Maintains progress across restarts

### Item Grouping

- **Default**: Items share the same maximum instant (better performance)
- **Max instant per item**: Tracks each item separately (more precise)

:::tip When to Use Per-Item Tracking (OPCUA, OPC, PI)
Use "Max instant per item" when:

- Data points update at different frequencies
- Source system doesn't guarantee synchronous writes
- You need individual progress tracking for each item

Note: This creates separate queries per item which may increase server load
:::

## Running a Query

### Execution Controls

Start or pause queries from:

- Editing page
- List page
- Display page

### Monitoring

The display page shows:

- Current progress
- Query status
- Items processed
- Estimated completion

:::caution Important Note
Any modifications to:

- Added/removed items
- Updated configurations
- Time range changes

will restart the query from the original start time.
:::
