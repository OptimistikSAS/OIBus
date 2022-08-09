---
sidebar_position: 7
---

# ADS - TwinCAT
The ADS protocol (Automation Device Specification) is a transport layer within TwinCAT systems, developed by 
Beckhoff.

Each data item is referenced by a unique address within the controller and can be accessed by OIBus with the ADS 
connector.

OIBus uses the [ads-client](https://github.com/jisotalo/ads-client) library.

## Connection settings
The AMS Router is the entity which connects ADS clients (OIBus) to PLCs and TwinCAT runtime. This allows OIBus to
access PLCs data.

Depending on the AMS Router location, several setups are possible. 

### With local TwinCAT runtime
When TwinCAT is installed on the same machine as OIBus, the ADS connector can use the same TwinCAT runtime and directly 
communicate with the PLC, with its Net ID and ADS Port.

The Net ID is an IP-like address with two additional numbers. Usually, the Net ID is the IP address on which the PLC is 
addressed from the network, with two additional numbers to address the appropriate PLC (several PLCs can be accessed 
from one AMS Router), for example `127.0.0.1.1.1`.

The port is the one used to contact the PLC from the AMS Router (by default 851).

### With remote ADS server

For a remote ADS server, the Net ID and the ADS Port are still required, and other fields are needed:
- **Router address**: the IP address (or domain name) of the AMS router
- **Router TCP port**: the port used by the AMS router
- **Client AMS Net ID**: a client identifier used to identify a connection with the TwinCAT runtime.
- **Client ADS port** (optional): the port used by the client to exchange data. If empty, it is given randomly by the 
AMS server. If filled, be sure that the port is not used by another client. 

TwinCAT runtime must accept the communication from the ADS connector. To do so, Static Routes must be added in the 
_TwinCAT Static Routes_ tool. The following example accepts two routes whose AmsNetId is to be used on the OIBus 
side. It is important that the AmsNetId is used through the IP address specified.

![TwinCAT Static Routes tool](@site/static/img/guide/south/ads/installation-ads-distant.png)

:::danger Multiple ADS connectors

Only one remote ADS connector can be set for OIBus. If two ADS connectors are needed to connect two PLCs, use a local
ADS server (available by default if OIBus is installed on the same machine as 
[the TwinCAT runtime](#with-local-twincat-runtime)).

:::

## Data settings and structures
### Points list
The ADS connector retrieves values from specific addresses. These can be added in the Points section (in the upper right 
corner).

In this list, points can be added with:
- **Point ID**: the address of the data in the targeted PLC (example: `GVL_Test1.TestINT`)
- **Scan mode**: the request frequency. To define more scan modes, see [Engine settings](docs/guide/engine/scan-modes.md).  

### Data settings
#### PLC name
In the case where data from similar PLCs (sharing the same point addresses for example) are retrieved from two ADS 
connectors and sent to the same North, the values will have the same point ID even though they come from two different 
PLCs. 

To avoid this ambiguity, the _PLC name_ can be added in front of each point ID once the data is retrieved. In this way,
the point IDs sent to the North connector will be differentiated.

:::tip Example

If PLC1 has for PLC name _PLC001._ (the dot is included in the name) and the point ID is MyVariable.Value, the 
resulting point ID once the values are retrieved will be _PLC001.MyVariable.Value_ and this will allow to identify the 
data in a different way than the PLC2 which will have a resulting point ID of _PLC002.MyVariable.Value_.

:::

#### Enumerations and booleans
An enumeration can be retrieved as an integer or as a character string (the PLC knows both thanks to its programming). 

A boolean value can be retrieved as an integer or a string (with 0 = false,1 = true).

#### Structures

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
