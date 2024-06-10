---
sidebar_position: 10
---

# OPCHDA
OPCDA and OPCHDA are communication protocols used in the industrial world and developed by the 
[OPC Foundation](https://opcfoundation.org/). This technology has been replaced by OPCUA but is still widely used in 
the industry. To use OPCUA in OIBus, see the [OPCUA connector documentation](./opcua.md).

An HDA server allows to retrieve the history of data over a more or less long period, while a DA server allows to 
retrieve only the most recent value of a tag.

Only OPCHDA is supported by OIBus. This connector uses the [OIBus Agent](../oibus-agent/installation.mdx), and a 
dedicated HDA module.

:::caution
The OIBus Agent must be installed on a Windows machine to use the HDA module.
:::

The HDA module can also be used as a standalone, to perform OPC history extractions in command line. See the 
[OPCHDA agent documentation](../oibus-agent/opchda.mdx#hda-module) to use the module in standalone and check the 
[COM/DCOM](../oibus-agent/opchda.mdx#comdcom-setup) setup documentation to properly install the module.

## Specific settings
OIBus exchanges commands and data with the HDA agent through a TCP server/client communication. Therefore, several 
fields must be filled to make OIBus communicate with the HDA Agent:
- **Remote agent URL**: Specify the URL of the remote OIBus agent, e.g., `http://ip-address-or-host:2224`.
- **Connection timeout**: Set the timeout for establishing a connection.
- **Retry interval**: Time to wait before retrying connection.
- **Server host**: Address of the OPC server (from the remote OIBus agent machine).
- **Server name**: Name of the OPC server (e.g. Matrikon.OPC.Simulation).

## Item settings
When configuring each item to retrieve data in JSON payload, you'll need to specify the following specific settings:
- **Node ID**: The Node ID corresponds to the path of the data within the appropriate namespace on the OPC server.
- **Aggregate**: Aggregate the retrieved values over the requested interval (be sure that the server supports the aggregate).
- **Resampling**: When aggregate is different from `Raw`, it is possible to resample the retrieved values at the requested
  interval.

:::caution Compatibility with the OPC server
It's important to note that not all aggregation and resampling options are supported by OPC servers. To avoid
compatibility issues, it's recommended to use `Raw` aggregation and `None` resampling whenever possible.    
:::

The name of the item will serve as a reference in JSON payloads, specifically in the `pointID` field for the North application. 