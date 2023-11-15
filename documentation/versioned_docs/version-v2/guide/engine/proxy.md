---
sidebar_position: 5
---

# Proxy
Some connectors need to send information through a proxy. Each proxy must be defined in the engine settings and can be 
reused by different OIBus connectors.

To define a proxy, the following fields must be specified:
- **Name**: identify the proxy. This name is used in OIBus connectors
- **Protocol**: `http` or `https`
- **Host**: the hostname or the IP address of the proxy
- **Port**: the port to connect to the proxy
- **User**: the username to authenticate the connection with the proxy
- **Password**: the password associated to the username
