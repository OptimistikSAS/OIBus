---
sidebar_position: 9
---

# ADS - TwinCAT
The ADS protocol (Automation Device Specification) is a transport layer within TwinCAT systems, developed by 
Beckhoff.

Each data item is referenced by a unique address within the controller and can be accessed by OIBus with the ADS 
connector.

OIBus uses the [ads-client](https://github.com/jisotalo/ads-client) library.

## Specific settings
The AMS Router is the entity which connects ADS clients (OIBus) to PLCs and TwinCAT runtime. This allows OIBus to
access PLCs data.

Depending on the AMS Router location, several setups are possible. 

### With local TwinCAT runtime
When TwinCAT is installed on the same machine as OIBus, the ADS connector can use the TwinCAT runtime and directly 
communicate with the PLC, with its **Net ID** and **Port**.

The Net ID is an IP-like address with two additional numbers. Usually, the Net ID is the IP address on which the PLC is 
addressed from the network, with two additional numbers to address the appropriate PLC (several PLCs can be accessed 
from one AMS Router), for example `127.0.0.1.1.1`.

The port is the one used to contact the PLC from the AMS Router (by default 851).

### With remote ADS server
For a remote ADS server, the Net ID and the ADS Port are still required, and other fields are needed:
- **Router address**: the IP address (or domain name) of the AMS router
- **Router TCP port**: the port used by the AMS router. It must be allowed by the firewall (both network and OS)
- **Client AMS Net ID**: a client identifier used to identify a connection with the TwinCAT runtime.
- **Client ADS port** (optional): the port used by the client to exchange data. If empty, it is given randomly by the 
AMS server. If filled, be sure that the port is not used by another client. 

TwinCAT runtime must accept the communication from the ADS connector. To do so, Static Routes must be added in the 
_TwinCAT Static Routes_ tool. The following example accepts two routes whose AmsNetId is to be used on the OIBus 
side. It is important that the **AmsNetId is used through the IP address specified**.

![TwinCAT Static Routes tool](../../../static/img/guide/south/ads/installation-ads-distant.png)

:::danger Multiple ADS connectors
Only one remote ADS connector can be set for OIBus. If two ADS connectors are needed to connect two PLCs, use a local
ADS server (available by default if OIBus is installed on the same machine as 
[the TwinCAT runtime](#with-local-twincat-runtime)).
:::

### Other specific settings
- **Retry interval**: Time to wait before retrying the connection
- **PLC name**: A prefix added to each item name before sending them into North caches. With PLC name _PLC001._ (the dot 
is included in the name) and the item name is MyVariable.Value, the resulting name once the values are retrieved will be 
_PLC001.MyVariable.Value_ and this will allow to identify the data in a different way than another PLC which will have 
a resulting item name of _PLC002.MyVariable.Value_ (for example).
- **Enumeration value**: Serialize the enumerations as integer or as text
- **Boolean value**: Serialize the booleans as integer or as text
- **Structure filtering**: See [below](#data-structures)

:::tip When to use PLC name
In the case where data from similar PLCs (sharing the same point addresses for example) are retrieved from two ADS
connectors and sent to the same North, the values will have the same point ID even though they come from two different
PLCs.

To avoid this ambiguity, the _PLC name_ can be added in front of each point ID once the data is retrieved. In this way,
the point IDs sent to the North connector will be differentiated. It is specially useful when exporting the items to import 
them in another OIBus: just change the PLC name and your data will be unique in the North targeted application.
:::

#### Data structures
It is also possible to query an entire data structure. For example, if the data **MyVariable** is of type _MyStructure_ and 
has the following fields:
- MyDate
- MyNumber
- Value

And if only _MyDate_ and _MyNumber_ must be retrieved, then, in the _ADS structures section_ a new structure can be added
with the name _MyStructure_, and in the fields part, only the two fields can be specified, separated by commas: 
_MyDate,MyNumber_

This is especially useful when several data (here **MyVariable**) are of type MyStructure, and only a few fields of the 
structure are requested (here _MyDate_ and _MyNumber_). The more fields the structure has, the more useful this feature 
is.

In the end, each field will give a unique resulting point ID. In the previous example, this will give for the single 
point **MyVariable** the following two points:
- MyVariable.MyDate  
- MyVariable.MyNumber

## Item settings
- **Address**: The address of the data to query in the PLC.