---
sidebar_position: 6
---

# History queries
OIBus primarily serves as a tool for data streaming, allowing you to retrieve data in real-time from various sources, 
such as points or files. However, it can also be valuable for retrieving historical data in situations where you need to 
access information prior to setting up the data streaming process. In such instances, historical queries can prove to 
be exceptionally beneficial.

## Create a History Query
On the History Query page, you have the option to generate new history query either through new South and North connectors 
or by choosing from existing South/North connectors.

:::info
You can select South connectors for historical data retrieval, but only those that are compatible with the historian, 
such as OPC UA, MSSQL, and others.
:::

When you select both the South and North connectors, all the information, including items from the South, is copied into 
the new History query. Please remove any unnecessary items.

## History main query settings
When you edit a History query, make sure to specify the start time and end time. If the time interval is substantial, 
you have the option to divide the query into smaller intervals within the `History settings` section.

:::caution About SQL connectors
Make sure to incorporate the **@StartTime** and **@EndTime** variables in SQL queries to effectively utilize split intervals.
:::

## Resilience
The maximum instant retrieved from a query is stored in a local cache database. In the event of a connection failure 
during a history query, OIBus will attempt to reconnect. Upon successful reconnection, it will resume the query from its 
last recorded maximum instant.

Certain connectors, such as OPC UA, offer the ability to group items together to share the same maximum instant. This 
grouping enhances OIBus's performance. However, there may be situations where it's beneficial to isolate individual items. 
To achieve this, you can select the **Max instant per item** option.

:::tip When to use Max instant per item
If data is not stored synchronously in the OPC UA server, there is a risk of losing some of it. To prevent such loss, 
it's advisable to maintain a maximum instant per item. However, it's important to exercise caution, as this approach will 
result in a separate query for each item instead of grouping them. While this ensures that you keep track of individual 
maximum instants, it may also potentially overload the server due to the increased query volume.
:::

## Running a query
You have the flexibility to initiate or pause a history query from its editing page, the list page, or the display page. 
When on the display page, you can also monitor the progress and status of the history query.

:::caution
When you make modifications to a history query by adding, removing, or updating items, the query will restart from the 
specified start time.
:::