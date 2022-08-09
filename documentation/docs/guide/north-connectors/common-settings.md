---
sidebar_position: 1
---

# Common North settings
## Add a connector
To add a North connector, click on the Engine menu, and select _Add North_. Select one of the available North connector 
types, name the connector and validate by clicking on _Add_.

## Main settings
The window may change depending on the selected type of connector. However, some concepts are the same. The 
navigation sub-menu (the grey bar at the page top) allows you to edit the connector name (top left) or to access the 
status of the connector (top right).

The status window displays several metrics, according to the connector.

The connector can be enabled or disabled from the toggle action, at the top of the **General settings** section.

## Caching
Refer to [this page](docs/guide/engine/cache-and-archive.md) to understand how and why OIBus manages caches.

The caching section allow OIBus to better manage network congestion:
- **Send interval**: time to wait between successive sending of data to a North (in ms).
- **Retry interval**: time to wait before retrying to send data to a North after a failure (in ms).
- **Group count**: Instead of waiting for _Send interval_, trigger the North connector to send the data as soon as the 
number of data to send reach this number.
- **Max group count**: When the connection is lost for some time, the cache of a north connector can store many data. 
To avoid sending them all at once, this field can be set to split the data to send in several smaller chunks of data, 
separated by _Send interval_.

It is also possible to enable archive mode, and to set a retention duration. With archive mode enabled, files will be
kept in the `archive` subfolder. Otherwise, they are deleted once sent to the North application.

:::caution Disk space

If you choose to keep files indefinitely, be careful to manually clear the archive folder from time to time. Otherwise, 
the archive folder may use a lot of disk space.

:::

## Subscription
By default, a North connector receives data from all activated South connectors. It is possible to subscribe a 
North connector to a specific South (or list of South connectors). In the Subscription section, add a South connector.
Only data from this South connector will be added to the cache of this North connector, all other South data will be 
discarded or sent to other North connectors if they are active.

:::info No data for disabled North

If a North connector is disabled, it won't store any data in its cache.

:::

## Network
If some proxies are defined in the [Engine section](docs/guide/engine/proxy.md), it is possible to select a proxy from the 
North connector to use when an HTTP query occurs. This setting is only possible for HTTP-compatible North connectors
(OIAnalytics, OIConnect).



