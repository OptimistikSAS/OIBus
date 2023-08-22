---
sidebar_position: 0
---

# Concept
## Add a connector
A North connector is used to send data to a target application. It reads data from its cache. The data can be stored in 
files or JSON payloads.

To add a North connector, go to the North page, and click on the **+** button. Select one of the available North
connector types, and fill its settings. The form may change depending on the type of connector selected. However, some
concepts are the same.

You can see the status of the North connector from its display page, or edit its settings.

## General settings
- **Name**: The name of the connector lets you remind with a user-friendly name what it does.
- **Description**: You can add a description to better remember some quirks (about the connection, access rights, etc.).
- **Toggle**: You can activate or pause the connector from the **enabled toggle**. However, from the North list or from
the display page, you can also toggle the connector.

## Specific section
Connector specific settings. Refer to the appropriate connector to have more details.

## Caching
The caching section allow OIBus to better manage network congestion:
- **Send interval**: Schedule the sending of data to a target application. See the [scan mode section](../engine/scan-modes.md)
to configure a new scan mode.
- **Retry interval**: time to wait before retrying to send data to a target application after a failure (in ms).
- **Retry count**: Number of retry before giving up and moving the failed data into the error folder.
- **Max size**: Maximum size of the cache (in MB). Once the maximum size in reach, additional data will be discarded.
- **Group count** (for JSON payloads): Instead of waiting for _Send interval_, trigger the North connector to send the 
data as soon as the number of data to send reach this number.
- **Max group count** (for JSON payloads): When the connection is lost for some time, the cache of a north connector can
store many data. To avoid sending them all at once, this field can be set to split the data to send in several smaller 
chunks of data, separated by _Send interval_.
- **Send file immediately**: Instead of waiting for _Send interval_, the North will directly send the file.

## Archive
It is also possible to enable archive mode, and to set a **retention duration**. With archive mode enabled, files will be
kept in the `archive` subfolder. Otherwise, they are deleted once sent to the North application.

If the retention duration is set to zero, it will keep files indefinitely.

:::caution Disk space
If you choose to keep files indefinitely, be careful to manually clear the archive folder from time to time. Otherwise,
the archive folder may use a lot of disk space.
:::

## Subscriptions
By default, a North connector receives data from all activated South connectors. It is possible to subscribe a 
North connector to a specific South (or list of South connectors). In the Subscriptions section, add a South connector
or an [External Source](../engine/external-sources.md).
Only data from this South connector / External Source will be added to the cache of this North connector, all other 
data will be discarded or sent to other North connectors if they are active / subscribed to this data source.

:::caution No data for disabled North
If a North connector is disabled, it won't store any data in its cache.
:::




