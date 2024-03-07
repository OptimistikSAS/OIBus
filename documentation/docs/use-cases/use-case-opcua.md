---
displayed_sidebar: useCasesSidebar
sidebar_position: 1
---

# OPCUA with OIAnalytics

## Beforehand
Details regarding the configurations can be located on the [North OIAnalytics](../guide/north-connectors/oianalytics.md)
and [South OPCUA](../guide/south-connectors/opcua.md) connectors pages.

Additionally, ensure that the selected protocol for connection is OPCUA, distinguishing it from 
[OPCDA or OPCHDA](../guide/south-connectors/opc-hda.md), which represent entirely distinct technologies.

## South OPCUA
### What you need to know
The complete URL of the OPCUA server, including the name, should be in the format `opc.tcp://<host>:<port>/<name>`, where:
- `host` represents the host name or IP address of the server.
- `port` indicates the port used by the server to accept connections.
- `name` denotes the name of the OPCUA server.

Specify the security mode your server accepts. If it differs from `None`, specify the security policy as well. 
Regarding authentication for OIBus on the server, it is not recommended to use `None` except for testing purposes. 

Provide the necessary username/password or certificates for authentication.

These details can be obtained from your IT team or the person responsible for the OPCUA server.

### Preparation

Prior to establishing the South connector, ensure that the OPCUA server is accessible (via IP address/hostname and port) 
from the machine where you have OIBus installed.

### South connector
Enter the required data into the settings. Before saving, use the `Test settings` button to verify the connection.

### Items
Add the node ID you wish to read. Consult the person in charge of the OPCUA server to determine the available data points.

You have the option to choose the access `mode` (DA or HA). In HA mode, you can aggregate and resample the data. Ensure 
that the server supports the selected aggregate and resampling options. If in doubt, stick with the `Raw` aggregate.

Opt for a [scan mode](../guide/engine/scan-modes.md) to fetch the data. In HA mode, a list of values is retrieved for 
an item since the last value was obtained, while in DA mode, only one value is retrieved at the requested time for one item.

:::tip Massive import
For bulk item import, start by clicking the `Export` button to obtain a CSV file with the correct columns. Each line in
the file will correspond to a new item. Ensure that the names are unique.
:::

## North OIAnalytics
### What you need to know
### Preparation
Verify that the OIAnalytics platform is accessible from the machine where OIBus is installed. To check this, enter the 
OIAnalytics URL in your web browser's address bar. If the page loads correctly, OIAnalytics is reachable. If not, ensure 
that your network firewall permits the connection.

The connection issue might be due to a port rule (HTTPS / 443, although very unlikely) or a domain name rule. Consult 
your IT team to add a rule allowing communication.

Within the OIAnalytics platform, navigate to the configuration settings.
In the user management section, create a profile with the following access rights:
- `Value: Query | Update`
- `File upload: Update resource`

Then create a user with such a profile and generate an access key for him.
Take care to securely store both the key and the secret : they will be required to set up the North OIAnalytics connector.

### North connector
Create the OIAnalytics North connector and populate the relevant fields.
Prior to saving, use the `Test settings` button to check the connection.
