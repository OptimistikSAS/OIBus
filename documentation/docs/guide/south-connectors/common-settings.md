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


