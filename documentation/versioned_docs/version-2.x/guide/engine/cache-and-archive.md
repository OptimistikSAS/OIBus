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

When getting values, the North cache first create a `<random-string>.buffer.tmp file` file which contains a JSON with the 
values retrieved from the South. These files allow OIBus to persist values right away.

Every 300ms, the North cache gather the `<random-string>.buffer.tmp` files into a `<random-string>.queue.tmp` single file
and put it at the end of the connector queue.

The queue is used at regular interval (parameter _Send Interval_) to send values into the North target. The values can 
be sent when a _Group count_ is reached. 

In case of failure (for example a network error), the size of the queue will grow. If _Max group count_ is reach, several 
queue files will be gathered into a single `<random-string>.compact.tmp` JSON file. These files will be on top of the queue
to be sent once the network comes back online. Increasing the max chunk size (number of values in each chunk) 
will increase the size of these compact files.

## Managing files
When a South connector retrieves files, it copies each file in the North cache directory (in the folder `files`).

If several North connectors are set and enabled, files will be duplicated in each North folder. In this case, make sure
to have enough disk space to manage them.

To set up archive mode, and tune caching settings from North specific configuration, refer to 
[this page](../north-connectors/common-settings.md).