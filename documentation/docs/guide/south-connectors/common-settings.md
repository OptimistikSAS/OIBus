---
sidebar_position: 1
---

# Concepts
A South connector is used to retrieve data from a data source. The data are sent into North caches. 
One connector can request several items. The nature of an item depends on the connector type. For example, an 
[MQTT item](./mqtt.md) will subscribe to a topic from a remote broker, and a [MSSQL item](./mssql.md) will regularly 
run a query at the Microsoft SQL database.

To add a South connector, go to the South page, and click on the **+** button. Select one of the available South 
connector types, and fill its settings. The form may change depending on the type of connector selected. However, some 
concepts are the same.

You can see the status of the South connector from its display screen, or edit its settings.

## General settings
- **Name**: The name of the connector lets you remind with a user-friendly name what it does. 
- **Description**: You can add a description to better remember some quirks (about the connection, access rights, etc). 
- **Toggle**: You can activate or pause the connector from the **enabled toggle**. However, from the south list or from 
the display screen, you can also toggle the connector.

## History settings
For history capable South connectors (SQL, OPCUA...), intervals of data can be requested. These intervals can be quite large 
depending on the scan mode, or if a network failure occurred for a long time. In this case, the history settings allows you
to split intervals into smaller intervals of **Max read interval** seconds. Each sub-intervals will be requested with a delay
of **Read delay**.

## Specific section
Connector specific settings. Refer to the appropriate connector to have more details.

## Item section
- **Name**: The name of the item is used as reference for North target applications. The name must be unique for a given 
south connector.
- **Scan mode**: It indicates to OIBus when to request the data. Some connectors (like [MQTT](./mqtt.md) or [OPCUA](./opcua.md))
can use a specific scan mode: `subscription`. Instead of having OIBus requesting data, it's the broker (MQTT) or server (OPCUA)
that send the data to the OIBus subscription.
-**Specific settings**: vary according to the connector type.

From the edition form or from the display screen of a connector, each item can be disabled. If so, it won't be requested 
by the connector.

### Item export
Items can be exported into CSV with the following columns:
- **id**: the unique ID used internally by OIBus. Must not me edited
- **name**: The name of the item
- **enabled**: 1 if the item is enabled, 0 otherwise
- **scanModeId**: The ID used to reference a scan mode
- **settings_**: All specific settings

The exported file will have the name of the connector: `connector.csv`.

### Item import
Items can be imported from a CSV. First, export a list of items. This way, you will have a properly set up file.
To update items, do not change the `id` of the item you want to edit, and edit the other fields.
To add items, keep and empty field for `id` and fill the other fields


