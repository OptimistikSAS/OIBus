---
sidebar_position: 5
---

# OPCHDA (Windows only)
OPCDA and OPCHDA are communication protocols used in the industrial world and developed by the 
[OPC Foundation](https://opcfoundation.org/). This technology has been replaced by OPCUA but is still widely used in 
the industry. To use OPCUA in OIBus, see the [OPCUA connector documentation](docs/guide/south-connectors/opcua.md).

An HDA server allows to retrieve the history of data over a more or less long period, while a DA server allows to 
retrieve only the most recent value of a tag.

Only OPCHDA is supported by OIBus. OIBus uses an HDA agent, i.e. a module integrated to OIBus, but available in 
standalone, to perform OPC history extractions in command line. See the 
[OPCHDA agent documentation](docs/guide/advanced/opchda-agent.md) to use the agent in standalone.

Both the OPCHDA connector and the standalone agent are available under Windows only and use Microsoft’s proprietary DCOM
technology to transfer information over the network. This technology is much more complex to set up than traditional TCP
communications. A dedicated guide is offered [here](docs/guide/advanced/opchda-dcom.md) to correctly setup HDA communications 
with COM/DCOM interfaces.


## OPCHDA connector
OIBus uses a HDA agent, compiled for Windows platforms, to interact with COM/DCOM interfaces. The HDA agent can also be
used [in standalone](docs/guide/advanced/opchda-agent.md). 

### HDA Agent section
OIBus exchanges commands and data with the HDA agent through a TCP server/client communication. Therefore, several 
fields must be filled to make OIBus communicate with the HDA Agent:
- **Agent filename**: the file path of the HDA Agent. By default, the HDA agent is in the same folder as the OIBus binary.
- **TCP port**: the TCP port that the HDA Agent will use to create its own TCP server. If you need two OPCHDA connectors, 
be careful to have two distinct TCP ports to avoid conflicts.
- **Logging level**: the level of log the HDA Agent will use. If the HDA agent log level is lower than the OIBus log levels, 
the lowest logs will be lost. See the [Engine log section](docs/guide/engine/logging-parameters.md) to know more about logging parameters.

### Connection and network
Some information are required to connect to the OPCHDA server:
- **Host**: the hostname or its IP address
- **Server name**: the name of the OPCHDA server

Several options are available to better manage network failure or inactivity:
- **Retry interval**: in case of connection failure, time to wait before reconnecting (in ms)
- **Max read interval**: split the request interval into smaller chunks (in s)
- **Read interval delay**: time to wait (in ms) between two sub-intervals in case a split occurs (ignored otherwise)
- **Max return values**: max number of values to retrieve **per node**. If 100 nodes are requested, this value is 
multiplied by 100 to have the total number of values retrieved.


### Accessing data
#### Scan groups
OIBus retrieves data by intervals. It is then possible to aggregate these values or to resample them. To do so, a scan 
mode must be selected (to create additional scan modes, see [Engine settings](docs/guide/engine/scan-modes.md)), with its 
associated aggregate and resampling options.

:::info Creating scan groups

Creating scan groups is mandatory to choose them in the _Points_ section when adding new points to request.

:::

:::danger Compatibility with the OPCUA server

Not every aggregate and resampling are supported by OPCUA server. _Raw_ aggregate and _None_ resampling are preferred to
avoid compatibility issues.

:::


#### Points and nodes
The OPCHDA connector retrieves values from specific addresses. Addresses (called node ID, or just node) are organized in
namespaces, in a tree-like structure. These can be added in the _Points section_ (in the upper right corner).

To request a data, specify the following fields:
- Point ID
- Node ID
- Scan group

The Node ID matches the path of the data in the appropriate namespace in the OPCHDA server. The point ID will be used
when sent to North connectors. It can be the same as the Node ID, but it allows friendlier names to manage.
