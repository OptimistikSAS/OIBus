---
sidebar_position: 0
---

# Common settings

A **North connector** sends data from OIBus to a target application. This page explains how to configure and manage
North connectors.

## Adding a North Connector

1. Navigate to the **North** page.
2. Click the **+** button.
3. Select a connector type and configure its settings.
4. Monitor or adjust settings from the connector's display page.

## General Settings

| Setting         | Description                                                                      | Example Value       |
| --------------- | -------------------------------------------------------------------------------- | ------------------- |
| **Name**        | A user-friendly label to identify the connector's purpose.                       | `My MQTT Connector` |
| **Description** | Optional details about the connection, access rights, or unique characteristics. | `Production broker` |
| **Enabled**     | Enable or disable the connector (from the list or its display page).             | Enabled/Disabled    |

:::caution Disabled North Connectors
A disabled North connector **will not cache any data**.
:::

## Specific Section

Refer to each connector’s documentation for type-specific settings.

### Testing Connection

Use the **Test settings** button to verify your connection configuration.

## Cache Settings

### Trigger Conditions

Configure when data is sent to the target application:

| Setting                | Description                                                                                         | Example Value |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------- |
| **Schedule**           | Define how often data is transmitted. Configure using [scan modes](../engine/scan-modes.mdx).       | `Every 10 s`  |
| **Number of elements** | (JSON payloads) Send data when the specified number of elements is reached, bypassing the schedule. | `1000`        |
| **Number of files**    | (Files) Send data when the specified number of files is reached, bypassing the schedule.            | `10`          |

### Throttling

Control data transmission to avoid overwhelming the target or network:

| Setting                                 | Description                                                                                           | Example Value |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| **Minimum delay between transmissions** | Time (in milliseconds) to wait between transmissions.                                                 | `1000`        |
| **Maximum number of elements**          | Maximum number of elements sent in a single transmission.                                             | `10000`       |
| **Maximum storage size**                | Maximum size (in MB) for cache + error + archive. Excess data is discarded once the limit is reached. | `1000`        |

### Errors

Manage how OIBus handles transmission failures:

| Setting                                 | Description                                                                    | Example Value |
| --------------------------------------- | ------------------------------------------------------------------------------ | ------------- |
| **Delay to wait before retry**          | Time (in milliseconds) to wait before retrying after a failure.                | `5000`        |
| **Number of retry**                     | Number of retry attempts before moving failed data to the error folder.        | `3`           |
| **Retention duration for errored data** | Duration (in hours) to retain errored data. Set to `0` to retain indefinitely. | `72`          |

:::tip Retryable Send
Some North connectors, such as the [OIAnalytics North Connector](./oianalytics.md), will **indefinitely retry** sending
data for specific errors (e.g., network failures), even after the retry count is exceeded.
:::

### Archive

Enable archiving to retain transmitted data:

| Setting                                  | Description                                                                     | Example Value    |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| **Enabled**                              | Toggle to enable or disable archiving.                                          | Enabled/Disabled |
| **Retention duration for archived data** | Duration (in hours) to retain archived data. Set to `0` to retain indefinitely. | `168`            |

:::caution Disk Space
If files are retained indefinitely, manually clear the archive folder periodically to avoid excessive disk usage.
:::

## Transformers

Transformers run **before data is cached** — they process incoming data from South connectors and determine what
actually enters the North connector's cache. You can apply one or more transformers to a North connector to:

- **Filter data**: Include or exclude specific data points based on source type.
- **Modify data**: Change values, rename fields, or restructure data.
- **Enrich data**: Add additional context or metadata.
- **Convert formats**: Transform data between different formats (e.g., JSON to CSV).

Each transformer is associated with a **source type** (the kind of data it accepts). When adding a transformer,
you select the source type first, then choose a compatible transformer for that North connector type.

:::info Standard Transformers
Standard transformers are pre-built and available based on the source type and North connector type. These transformers
cover common use cases and can be configured directly in the UI.
:::

:::tip Custom Transformers
For advanced use cases, you can create custom transformers:

- Go to the [Engine transformers section](../engine/transformers.mdx).
- Create a new transformer with your own code.
- Define configurable options for the transformer.

Your custom transformer will then be available for selection in the North connector settings.

:::

## Data Filtering

Transformers are also the mechanism for filtering which data a North connector receives. By selecting a specific
source type when adding a transformer, you control what kinds of data are accepted into the cache.

:::info Current behaviour
Data that arrives at a North connector and is **compatible with its type** is cached and sent by default, even if no
transformer is configured for that source type.

This default behaviour is planned to change in a future OIBus release — unmatched data will be **ignored by default**
rather than forwarded. If you rely on implicit forwarding today, add an explicit transformer to preserve that behaviour
after the upgrade.
:::
