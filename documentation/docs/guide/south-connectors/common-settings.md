---
sidebar_position: 0
---

# Common Settings

A **South connector** fetches data from a specific source (e.g., MQTT broker, MSSQL database) and forwards it to North
caches. Each connector can manage multiple items, with the nature of each item depending on the connector type (e.g.,
subscribing to a topic, querying a database).

## Adding a South Connector

1. Navigate to the **South** page.
2. Click the **+** button.
3. Select a connector type and configure its settings.
4. Monitor or adjust settings from the connector’s display page.

## General Settings

| Setting         | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| **Name**        | User-friendly label for easy identification.                                  |
| **Description** | Optional context (connection details, access rights, unique characteristics). |
| **Enabled**     | Enable/disable the connector from the list or its display page.               |

## Specific Section

Refer to each connector’s documentation for type-specific settings.

### Testing Connection

Use the **Test settings** button to verify your connection configuration.

## Item Section

Items retrieve data as files or JSON payloads. Each item requires:

| Setting               | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| **Name**              | Unique reference for North target applications.                            |
| **Scan mode**         | Determines when OIBus requests data (e.g., `subscription` for MQTT/OPCUA). |
| **Specific settings** | Varies by connector type.                                                  |

### Item Actions

- **Disable/Enable**: Toggle from the item’s edit form or the connector’s display page.
- **Test**: Verify item settings and results from the edit/create modal.
  > **Tip**: Test connection settings before testing items.

### Import/Export Items

- **Export**: Download items as a CSV with columns: `name`, `enabled`, `scanMode`, and `settings_*`.
- **Import**: Use a CSV template (export an existing list for reference).
  > **Note**: The system validates for duplicates and correct formatting before adding items.

## Max Instant and Scan Mode Management

History-capable South connectors track the last `max_instant` in the `cache.db` database. Behavior varies by connector:

- **Database connectors**: Always use `Max instant per item` internally.
- **OPCUA** (HA mode), **OPC Classic** (HDA mode), **OSIsoft PI**: Choose between per-item or grouped `max_instant`.

This section explains how OIBus manages the `max_instant` value when you modify the connector or item configuration. The
behavior depends on whether **Max instant per item** is enabled or disabled, and the specific action you perform (e.g.,
changing scan modes, removing items, or deleting the connector).

### Max Instant Per Item: **Enabled**

- **Change scan mode**: Removes the old cache entry for the item and creates a new entry using the previous `max_instant`.
- **Remove item**: Deletes the cache entry for this specific item.
- **Remove connector**: Deletes all linked items and their associated cache entries.

### Max Instant Per Item: **Disabled**

When disabled, **all items sharing the same scan mode use a single `max_instant`**. This is especially useful for connectors where multiple data points are stored or updated simultaneously (e.g., OPCUA), as it ensures consistent timestamp tracking across items.

In this mode, the `max_instant` is tied to the **scan mode**, not individual items.

- **Change scan mode**:
  - If the new scan mode has **no existing entry**: Removes the old entry (if no other items use it) and creates a new entry with the previous `max_instant`.
  - If new scan mode **already has an entry**: No new entry; uses existing `max_instant`.
    > **Warning**: Changing scan modes may cause duplicate queries or data loss if `max_instant` differs
    > significantly.
- **Remove item**: Deletes cache entry only if no other items use the same scan mode.
- **Remove connector**: Deletes all items and cache entries.

### Transitioning Between Modes (Max Instant Per Item)

- **Disabled → Enabled**: Removes grouped cache entries, creates per-item entries with previous `max_instant`.
- **Enabled → Disabled**: Removes per-item entries, creates grouped entries with the latest `max_instant` per scan mode.
  > **Warning**: Data loss may occur if `max_instant` values differ.

---

## Example Scenarios

### Max Instant Per Item: Enabled

**Before**:
| south_id | scan_mode_id | item_id | max_instant |
|----------|--------------|---------|---------------------------|
| south1 | scan_prev | item1 | 2024-02-16T00:00:00.000Z |
| south1 | scan_prev | item2 | 2024-02-16T00:00:00.000Z |

**After changing scan mode**:
| south_id | scan_mode_id | item_id | max_instant |
|----------|--------------|---------|---------------------------|
| south1 | scan_new | item1 | 2024-02-16T00:00:00.000Z |
| south1 | scan_prev | item2 | 2024-02-16T00:00:00.000Z |

### Max Instant Per Item: Disabled

**Before**:
| south_id | scan_mode_id | item_id | max_instant |
|----------|--------------|---------|---------------------------|
| south1 | scan_prev | all | 2024-02-16T00:00:00.000Z |

**After changing scan mode**:
| south_id | scan_mode_id | item_id | max_instant |
|----------|--------------|---------|---------------------------|
| south1 | scan_new | all | 2024-02-16T00:00:00.000Z |
