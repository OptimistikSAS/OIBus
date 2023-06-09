---
sidebar_position: 7
---

# External sources
Declaring an external source is useful when values and files are sent directly to OIBus endpoints `/engine/addValues` 
and `/engine/addFile`. These endpoints require the `name` query param to identify the source. When it comes from another
OIBus with [OIConnect](docs/guide/north-connectors/oiconnect.md), the name can be for example `MyFirstOIBus:MyOIConnect`.

A North connector can only subscribe to external sources of data, explicitly defined in the **External sources**
section.

To do so, click on the add button and fill the ID of the newly created external source with `MyFirstOIBus:MyOIConnect` 
where MyFirstOIBus is the name of the source OIBus, and MyOIConnect is the name given to the North connector of the 
source OIBus.
