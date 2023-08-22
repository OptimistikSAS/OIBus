---
sidebar_position: 6
---

# History queries
OIBus is mainly used for data streaming: you want to get data regularly, from points or files, as they come in your data source.

## Create a History Query
From the History Query page, you can create new history either from new South and North connectors, or by selecting 
existing South/North connectors.

:::info
Only historian capable South can be selected (OPCUA, MSSQL...)
:::

When selecting an existing South, all its items will be copied in the new History.

## History main query settings
When editing a History query, fill the start time and end time. When this interval is quite large, you can split the 
query into smaller intervals in the `History settings` section. 

:::tip 
Be sure to use @StartTime and @EndTime variables when appropriate to make use of split intervals.
:::

## Resilience
The **max instant** retrieved is stored in a local cache database. If a connection failure occurs during the history query, 
OIBus will try to reconnect. When the reconnection succeeds, it will take back the query from its **last max instant**.

Some connectors, like OPCUA, can group items together to share the same max instant. By grouping points together, OIBus
has better performances. However, in some cases, it may be useful to isolate the items. To do so, check the **Max instant 
per  item** option.

## Running a query
You can start or pause a history query from its edition page, from the list page or from the display page. On the display 
page, you can monitor how the History query goes.

:::caution
When editing a History query, adding, removing or updating items, the query restart from the start time.
:::