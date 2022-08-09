---
sidebar_position: 4
---

# Cache and archive
All files and values are stored in local caches (one for each North connector). In case communication errors prevent 
OIBus to send information to a North connector, they will be retried regularly, even after a machine restart.

When the communication is restored, all files and values in the cache are forwarded to the North connector. 

:::tip Cache location

The cache is located in the `cache` folder (`data-stream` and `history-query`) and each connector has its own folder in
the form `north-id` or `south-id`.

:::

## Managing values
When a South connector retrieves values, they are sent to each activated North and gathered in batches, directly written 
on disk for persistence in case of server crash (in the folder `values`). 
The values are flush in the queue (in-memory buffer) and persisted into chunk files on either one of the following conditions:
- The max buffer size is reached (default is 250)
- The buffer flush interval is reached (default is 300 ms)

The queue is used at regular interval (parameter _Send Interval_) to send values into the North. The values can be sent
when a _Group count_ is reached. The max chunk size (number of values in each chunk, parameter _Max group count_) can 
be set to limit the size of the payload when taking back the network activity.


## Managing files
When a South connector retrieves files, it copies each file in the North cache directory (in the folder `files`).

If several North connectors are set and enabled, files will be duplicated in each North folder. In this case, make sure
to have enough disk space to manage them.

To set up archive mode, and tune caching settings from North specific configuration, refer to 
[this page](docs/guide/north-connectors/common-settings.md).
