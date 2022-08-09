---
sidebar_position: 1
---

# OIBus access
## OIBus port
The default port is 2223 and is used to access the OIBus settings from a web interface at `http://localhost:2223`. This 
port can be changed in case of conflict or for security reasons.

## Safe mode
In case of OIBus error, the safe mode is activated. Running OIBus in safe mode deactivates all connectors: it is mostly 
used to be able to access OIBus settings even if there is some runtime issues with a connector. The safe mode must be
deactivated for OIBus to receive and send data.

## IP Filters
Only local access is enabled by default. You can see that from the IP Filter section where localhost is defined in IPv4 
and IPv6 format.

You can add a remote address to access OIBus from a remote workstation. However, keep in mind that only http is used to 
access OIBus since OIBus is rarely attached to a machine with a domain name and certificate installed. So, if you need
to access OIBus remotely, please do so through a VPN or any secure channels. See the 
[security section](docs/guide/advanced/oibus-security.md) to learn more about the security in OIBus.
