---
sidebar_position: 0
---

# Concept
A North connector is employed to transmit data to a designated target application, extracting the data from its cache. 
Data can be delivered either as files or JSON payloads.

To incorporate a North connector, navigate to the North page and click the '+' button. Choose one of the available North
connector types and complete its settings. The form's structure varies depending on the chosen connector type, but 
certain principles remain consistent.

You can monitor the status of the North connector from its display page or make adjustments to its settings.

## General settings
- **Name**: The connector's name serves as a user-friendly label to help you easily identify its purpose.
- **Description**: You have the option to include a description to provide additional context, such as details about the 
connection, access rights, or any unique characteristics.
- **Toggle**: You can enable or disable the connector using the toggle switch. Additionally, you can toggle the connector 
from either the North connector list or its dedicated display page (accessible via the magnifying glass icon of the list 
page).

## Specific section
Specific settings for the connector can be found in the respective connector's documentation for more detailed information.

## Caching
The caching section plays a crucial role in helping OIBus efficiently manage network congestion:
- **Send interval**: This setting allows you to schedule the transmission of data to a target application. Refer to the
[scan mode section](../engine/scan-modes.md) for configuring new scan modes.
- **Retry interval**: Specifies the waiting period before attempting to resend data to a target application after a 
failure (measured in milliseconds).
- **Retry count**: Indicates the number of retry attempts before giving up and relocating failed data to the error folder.
- **Max size**: This parameter defines the maximum size of the cache in megabytes (MB). Once the cache reaches its maximum 
size, any additional data will be discarded.
- **Group count** (for JSON payloads): Instead of waiting for the _Send interval_, this feature triggers the North 
connector to transmit data as soon as the specified number of data items is reached.
- **Max group count** (for JSON payloads): When the connection experiences prolonged downtime, the cache of a North 
connector may accumulate a substantial amount of data. To prevent overwhelming the target or the network, this field can 
be set to split the data into multiple smaller chunks, each sent separately at intervals defined by the _Send interval_.
- **Send file immediately** (for files): This option enables the North connector to send the file directly, bypassing the 
_Send interval_ waiting period.

## Archive
It is also possible to enable archive mode, and to set a **retention duration**. With archive mode enabled, files will be
kept in the `archive` subfolder. Otherwise, they are deleted once sent to the North application.

If the retention duration is set to zero, it will keep files indefinitely.

You can also activate archive mode and define a **retention duration**. When archive mode is enabled, files will be preserved 
in the `archive` subfolder; otherwise, they will be deleted once transmitted to the North application.

If you set the retention duration to zero, it means that files will be retained indefinitely.

:::caution Disk space
If you opt to retain files indefinitely, it's essential to remember to periodically manually clear the archive folder. 
Failing to do so could result in the archive folder consuming a significant amount of disk space.
:::

## Subscriptions
By default, a North connector collects data from all activated South connectors. However, you have the option to subscribe 
a North connector to a particular South connector or a list of South connectors (or [External Source](../engine/external-sources.md)).
In the Subscriptions section, you can add a specific South connector or an External source. This means that only data from 
the specified South connector or External Source will be included in the cache of this North connector. All other data 
will either be discarded or sent to other active North connectors that are subscribed to the data stream.

:::caution No data for disabled North
When a North connector is disabled, it will not store any data in its cache.
:::




