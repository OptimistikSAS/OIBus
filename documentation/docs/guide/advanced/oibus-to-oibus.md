---
sidebar_position: 2
---

# OIBus to OIBus communication
## Context
Sometimes, PLCs or databases are only accessible in a private network. Let's call it the **industrial network**. This 
network often exists inside or beside another network ; let's call it the **office network**.
Two options exist to access these data:
- Allow connections to each data source from the OIBus machine (which is in the office network, outside the industrial 
network) through the firewall
- Install one OIBus in the industrial network and one OIBus in the office network.Manage a single communication between 
the two networks.

The first option is acceptable if you have only one machine on which to install OIBus, but it involves more network 
settings to manage and risk the exposing of your machines. 
The second option is preferable. Indeed, the first OIBus in the industrial network - OIBus1 - can access the machine in
the same network, and send data to the office network through a single connection allowed in the firewall (from OIBus1 
to OIBus2).

Let's see how to set up this communication.

## Data
### Set up a North connector OIConnect in OIBus1
[OIConnect](../north-connectors/oiconnect.md) is very useful when one OIBus has no internet access (because it is 
isolated in an industrial network) but can communicate to another OIBus which is in another network with internet access.

The host could be something like `http://1.2.3.4:2223` where 1.2.3.4 is the IP address and 2223 is the port of the
second OIBus. Be careful to authorize remote connection in the second OIBus Engine settings in the
[IP Filter section](../engine/ip-filters.md) and to use the appropriate username and password (using Basic
Authentication). In this case, the OIBus username and password must be used (by default, admin and pass).

### Set up an External source in OIBus2
On the second OIBus, if you don't have declared an external source, the data will be discarded. Then, you must first
declare an [external source](../engine/external-sources.md). Its name must follow the syntax of the [name query
param](docs/guide/north-connectors/oiconnect.md#query-param), for example `MyOIBus:MyOIConnect`.

The North connector can now subscribe to this specific external source.

## Logs
### Loki through another OIBus
To send logs to OIBus2, go to the Engine page in the _Loki logs_ section, and specify the OIBus2 address in the 
**Host** field and its associated endpoint. For example: `http://1.2.3.4:2223/logs`.
OIBus2 uses Basic Auth. Keep empty the token address field and fill the username and password used to connect to OIBus2. 

If the loki level set in OIBus1 is **info**, only info and above levels will be sent to OIBus2. In OIBus2, if the 
console and file levels are set to **error**, only error levels will be logged on the console and 
file. However, if the loki level is set to **info** too, all the logs received from OIBus1 will be sent to this loki 
endpoint.
