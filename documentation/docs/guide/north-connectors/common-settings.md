---
sidebar_position: 0
---

# Common settings

A **North connector** sends data from OIBus to a target application. This page explains how to configure and manage
North connectors.

## Adding a North Connector

1. Navigate to the **North** page.
2. Click the **+** button.
3. Select a North connector type from the available options.
4. Complete the settings form (structure varies by connector type).

You can monitor the connector's status or adjust its settings from its **display page** (accessible via the magnifying
glass icon in the list).

## General Settings

| Setting         | Description                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| **Name**        | A user-friendly label to identify the connector's purpose.                       |
| **Description** | Optional details about the connection, access rights, or unique characteristics. |
| **Toggle**      | Enable or disable the connector (from the list or its display page).             |

:::caution Disabled North Connectors
A disabled North connector **will not cache any data**.
:::

## Cache Settings

### Trigger Conditions

Configure when data is sent to the target application:

| Setting                | Description                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Schedule**           | Define how often data is transmitted (e.g., "Every 10 seconds"). Configure using [scan modes](../engine/scan-modes.mdx). |
| **Number of elements** | (JSON payloads) Send data when the specified number of elements is reached, bypassing the schedule.                      |
| **Number of files**    | (Files) Send data when the specified number of files is reached, bypassing the schedule.                                 |

### Throttling

Control data transmission to avoid overwhelming the target or network:

| Setting                                 | Description                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Minimum delay between transmissions** | Time (in milliseconds) to wait between transmissions.                                                 |
| **Maximum number of elements**          | Maximum number of elements sent in a single transmission.                                             |
| **Maximum storage size**                | Maximum size (in MB) for cache + error + archive. Excess data is discarded once the limit is reached. |

### Errors

Manage how OIBus handles transmission failures:

| Setting                                 | Description                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| **Delay to wait before retry**          | Time (in milliseconds) to wait before retrying after a failure.                |
| **Number of retry**                     | Number of retry attempts before moving failed data to the error folder.        |
| **Retention duration for errored data** | Duration (in hours) to retain errored data. Set to `0` to retain indefinitely. |

:::tip Retryable Send
Some North connectors, such as the [OIAnalytics North Connector](./oianalytics.md), will **indefinitely retry** sending
data for specific errors (e.g., network failures), even after the retry count is exceeded.
:::

### Archive

Enable archiving to retain transmitted data:

| Setting                                  | Description                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| **Enabled**                              | Toggle to enable or disable archiving.                                          |
| **Retention duration for archived data** | Duration (in hours) to retain archived data. Set to `0` to retain indefinitely. |

:::caution Disk Space
If files are retained indefinitely, manually clear the archive folder periodically to avoid excessive disk usage.
:::

## Transformers

Transformers allow you to **modify or enrich data** before it is sent to the target application. You can apply one or
more transformers to a North connector to:

- **Filter data**: Include or exclude specific data points.
- **Modify data**: Change values, rename fields, or restructure data.
- **Enrich data**: Add additional context or metadata.
- **Convert formats**: Transform data between different formats (e.g., JSON to CSV).

### Adding a Transformer

1. Navigate to the **Transformers** section in the North connector settings.
2. Click **Add Transformer** and select a source type from the list.
3. Choose an **available transformer** compatible with both the source type and the North Connector type.
4. Configure the transformer settings as needed.

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

## Subscriptions

By default, a North connector collects data from **all active South connectors**. You can restrict this by subscribing
to specific: South connectors.

Only data from the selected sources will be cached. Other data will be discarded or sent to other active North
connectors.
