---
sidebar_position: 2
---

# OIBus to OIBus communication
## Context
Often, PLCs are exclusively reachable within a restricted network known as the Operational Technology (OT) domain which 
often coexists either within or adjacent to another network, the Information Technology (IT) domain, with datacenters and
cloud systems. OT machines, for security reasons, don't have access to internet. OIBus may need an internet access. There 
are two viable approaches for accessing data within these networks:
- Install OIBus in the IT domain, and allow connections of PLCs in OT from the OIBus Machine. In this approach, you permit
connections to each data source from the OIBus machine, which resides in the IT (external to the OT) through the firewall.
- Installing OIBus in both networks: The second option involves setting up one instance of OIBus within the OT and another 
within the IT. This enables the management of a single communication link between the two networks.

The first option is acceptable when you have only one machine available for OIBus installation, but it entails a more 
complex network configuration and carries the risk of exposing your machines to potential security threats. The second 
option is a preferable choice. With this approach, the initial OIBus instance in the OT, referred to as OIBus1, can 
access machines within the same network and transmit data to the office network via a single firewall-permitted connection 
(from OIBus1 to OIBus2).

Let's delve into the details of setting up this communication method.


## Data stream set-up
### Set up a North connector OIConnect in OIBus1
[OIBus North connector](../north-connectors/oibus.md) proves highly valuable when one OIBus instance lacks direct internet 
access, often due to isolation within an industrial network. However, it can establish communication with another OIBus 
located in a different network that does have internet access.

For instance, the host address might take the form of http://1.2.3.4:2223, (IP address and port of OIBus2). It's crucial 
to ensure that remote connections are authorized in the settings of the second OIBus Engine, specifically within the 
[IP Filter section](../engine/ip-filters.md). Additionally, the appropriate username and password should be utilized. In 
this case, the OIBus default username and password (admin and pass) should be employed for authentication purposes.

### Set up an External source in OIBus2
On OIBus2, you must now define an [External Source](../engine/external-sources.md). If no external source is set in OIBus2,
data sent by OIBus1 to OIBus2 will be discarded. 

The name of this external source should adhere to the syntax of the name query param, for instance, `MyOIBus:MyOIConnect`.

With the external source defined, the North connector of OIBus2 can then proceed to subscribe to this specific external source, 
enabling the exchange of data between the two OIBus instances.

## Logs
### Loki through another OIBus
To transmit logs to OIBus2 from OIBus1, navigate to the [Engine page](../engine/engine-settings.md) within the _Loki logs_ 
section and specify OIBus2's address in the **Host** field, along with its associated endpoint: http://1.2.3.4:2223/logs. 
It's important to note that OIBus2 utilizes Basic Authentication. Keep the token address field empty and provide the username 
and password credentials used to connect to OIBus2.

In cases where the loki level is set to **info** in OIBus1, only logs with **info** level and above will be forwarded to 
OIBus2. 

In OIBus2, if the console and file levels are configured to **error** only logs with **error** level or higher will be 
recorded in the console and file. However, if the loki level in OIBus2 is also set to **info** all the logs received 
from OIBus1 will be sent to this loki endpoint (set in OIBus2).

