---
sidebar_position: 0
---

# Concept
A South connector is responsible for fetching data from a specific data source and forwarding that data into North caches. 
Each connector can request multiple items, and the nature of each item varies depending on the connector type. For example, 
an [MQTT item](./mqtt.md) subscribes to a topic from a remote broker, while an [MSSQL item](./mssql.mdx) regularly queries 
a Microsoft SQL database.

To add a South connector, navigate to the South page and click the '+' button. Choose one of the available South connector 
types and complete its settings. The form structure may vary based on the selected connector type, but certain principles 
remain consistent.

You can monitor the status of the South connector from its display page or make adjustments to its settings.

## General settings
- **Name**: The connector's name serves as a user-friendly label to help you easily identify its purpose.
- **Description**: You have the option to include a description to provide additional context, such as details about the
  connection, access rights, or any unique characteristics.
- **Toggle**: You can enable or disable the connector using the toggle switch. Additionally, you can toggle the connector
  from either the South connector list or its dedicated display page (accessible via the magnifying glass icon of the list
  page).

## History settings
For South connectors capable of historical data retrieval (e.g., SQL, OPCUA), you have the flexibility to request data 
in intervals. These intervals can vary in size, depending on factors such as the chosen scan mode or the presence of 
prolonged network failures. To handle such scenarios, the history settings enable you to divide large intervals into 
smaller sub-intervals, each no longer than the specified **Max read interval** in seconds. These sub-intervals are requested 
with a delay defined by the **Read delay** setting.

In certain situations, adding an overlap to the history query can be beneficial. You can achieve this by configuring 
the **overlap** field (in milliseconds): it will subtract this specified number of milliseconds from the `@StartTime`
variable of the subsequent query.

## Specific section
Specific settings for the connector can be found in the respective connector's documentation for more detailed information.

### Testing connection
The **Test settings** button provides a convenient way to verify and test your connection settings.

## Item section
Items are entities responsible for retrieving data from the targeted data source, which can be fetched as either files 
or JSON payloads. A South connector can handle several items. When editing an item, you'll need to provide the following information:
- **Name**: The item's name serves as a reference for North target applications. It must be unique within a given South connector.
- **Scan mode**: The [scan mode](../engine/scan-modes.md) indicates to OIBus when to request data. Some connectors (such 
as MQTT or OPCUA) may have a `subscription` scan mode where the broker (MQTT) or server (OPCUA) sends data to OIBus.
- **Specific settings** for items may vary based on the connector type. 
 
Additionally, each item can be disabled either from the item's edit form or from the connector's display page. When an 
item is disabled, it will not be requested by the connector.

### Item export
You can export items into a CSV file with the following columns:
- **name**: The name of the item.
- **enabled**: A value of 1 if the item is enabled, or 0 if it's disabled.
- **scanMode**: The name of the scan mode.
- **settings_***: All specific settings for the item.

The exported file will be named after the connector: `connector.csv`.

### Item import
You can import items from a CSV file. To do this, it's recommended to first export a list of items so that you have a 
properly formatted file to use as a template for importing.

:::info
When you upload a CSV file, the system will perform checks for duplicates and validate the settings. After the validation 
process, all correctly formatted items will be added.
:::

### Changing scan mode and max instant issue
History-capable South connectors maintain a record of the last maximum instant in the `cache.db` database's `cache_history`
table. This section provides an in-depth explanation of how the max instant, associated with scan modes and items, operates.


For Database South connectors, the `Max instant per item` option is always enabled and cannot be changed. In South 
connectors like OPCUA (in HA mode), users have the choice to maintain one max instant per item, even if they share the 
same scan mode, or to group items with the same scan mode together, resulting in a single max instant.

#### Max instant per item is `enabled`
##### Change an item’s scan mode
Changing an item's scan mode results in the removal of the previous cache entry and the creation of a new cache entry, 
utilizing the preceding `max_instant`.

- Example: changing the scan mode of item1 from `scan_prev` to `scan_new`.

    **`cache_history` table (in `cache.db` database) before change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | item1   | 2024-02-16T00:00:00.000Z |

    **`cache_history` table (in `cache.db` database) after change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | item1   | 2024-02-16T00:00:00.000Z |

##### Remove an item
It deletes the item from the `south_items` table in the `config.db` database and the corresponding entry from the 
`cache_history` table in the `cache.db` database.

##### Remove the south
It removes all linked items from the `south_items` table in the `config.db` database and their associated entries from
the `cache_history` table in the `cache.db` database.

#### Max instant per item is `disabled`
##### Change an item’s scan mode
- Example: The new scan mode is not present in the `cache_history` table (in `cache.db` database)
  It removes the previous cache entry, but **only if there are no other items utilizing the previous scan mode**. 
  Subsequently, it creates a new cache entry, utilizing the previous **max_instant**.

    **`south_items` table (in `config.db` database) before change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |

    **`cache_history` table (in `cache.db` database) before change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    **`south_items` table (in `config.db` database) after change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_new     | item1   |
    | south1   | scan_prev    | item2   |

    **`cache_history` table (in `cache.db` database) after change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-02-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    In this scenario, a new cache entry is generated (`south1 → scan_new`), but the old one (`south1 → scan_prev`) 
    is retained because `item2` still employs the previous scan mode.    

    :::info
    If `item1` was the sole item using `scan_prev`, the `south1 → scan_prev` entry would have been deleted. Consequently,
    if the scan mode for `item1` is reverted to `scan_prev`, it will adopt the `max_instant` of the `scan_new`. However, 
    if the `south1 → scan_prev` combination still exists, please refer to the next case.
    :::

- Example: The new scan mode is present in the `cache_history` table (in `cache.db` database)
  It removes the previous cache entry, but **only if there are no other items using the previous scan mode**, and it will 
  **not** create a new cache entry nor update the existing `max_instant`.

    **`south_items` table (in `config.db` database) before change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history` table (in `cache.db` database) before change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    **`south_items` table (in `config.db` database) after change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | **scan_new** | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history` table (in `cache.db` database) after change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    In this case, a new cache entry is **not** created (`south1 → scan_new`) because it already exists in the table. 
    Additionally, `scan_prev` is not removed because `item2` still utilizes it.
    
    :::info
    If `item1` was the only item using `scan_prev`, the `south1 → scan_prev` entry would have been removed.  
    :::

    However, two issues arise:
    - `item1` is now utilizing a `max_instant` that is one month in the past compared to its previous `max_instant`. 
    This results in duplicate queries between the two `max_instant`. As `item1` transitions from `scan_prev` (2024-02-16)
    to `scan_new` (2024-01-16), it retroactively processes data for the previous month. 
    - Conversely, the same situation can occur in the opposite manner, resulting in a month's worth of data not being 
    retrieved.

##### Remove an item
It deletes the cache entry in the `cache.db` database **only if there are no other items utilizing the same scan mode 
as the item**.

##### Remove the south
It removes all linked items from the `south_items` table in the `config.db` database and their associated entries from
the `cache_history` table in the `cache.db` database.

#### Max instant per item `disabled`→`enabled`
It removes all cache entries with item_id `all` linked to the south, and it creates new cache entries for each item. The 
`max_instant` of these new entries will be the `max_instant` of the previously removed ones, based on scan mode.

- Example
    **`south_items` table (in `config.db` database) before change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history` table (in `cache.db` database) before change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    **`south_items` table (in `config.db` database) after change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_new     | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history` table (in `cache.db` database) after change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | item1   | 2024-02-16T00:00:00.000Z |
    | south1   | scan_prev    | item2   | 2024-02-16T00:00:00.000Z |
    | south1   | scan_new     | item3   | 2024-01-16T00:00:00.000Z |

#### Max instant per item `enabled`→`disabled`
It removes all cache entries associated with the south and establishes new cache entries for the scan modes utilized by 
the items. Only one entry is added per scan mode. Each new cache entry will have the **latest** `max_instant` from the list
of previous items using the scan mode of that entry.

- Example
    **`south_items` table (in `config.db` database) before change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |
    
    **`cache_history` table (in `cache.db` database) before change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | item1   | 2024-02-16T00:00:00.000Z |
    | south1   | scan_prev    | item2   | 2024-02-20T00:00:00.000Z |
    | south1   | scan_new     | item3   | 2024-01-16T00:00:00.000Z |

    **`south_items` table (in `config.db` database) after change**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_new     | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history` table (in `cache.db` database) after change**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-20T00:00:00.000Z |

    In this case the `max_instant` for `scan_prev` is set to 2024-02-20 instead of 2024-02-16, because it’s a newer date. 
    It may cause data loss.
