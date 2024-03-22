---
sidebar_position: 1
---

# OIBus Settings

## OIBus port

The default port for accessing OIBus settings through a web interface is 2223, and it is accessible
at `http://localhost:2223`.
You have the option to modify this port in the event of conflicts or for security purposes.

# Proxy server

OIBus can play the role of a proxy server by enabling this option and setting the port to listen from. Be sure that your
firewall allows inbound connection on this port.
The proxy will simply forward the HTTP requests to the targeted host embedded in the query.

Additionally, the IP source must be allowed inside OIBus in the [IP filter](./ip-filters.md) section.

It is useful to enable this settings if two OIBus are installed in two separate networks, one with internet access (
OIBus1),
one without (OIBus2). With a proxy server installed on OIBus1, OIBus2 can send data through OIBus1 proxy to internet if
the North connector allows it.

:::tip OIAnalytics integration
Using such a proxy can be done in the OIAnalytics registration settings. Retrieving commands, sending logs, or sending
data (from [North OIAnalytics connector](../north-connectors/oianalytics.md)) will then send data through this proxy.
:::

# Logging parameters

OIBus logs encompass six levels, ranging from the most critical to the least:

- None (deactivates the logs)
- Error
- Warning
- Info
- Debug
- Trace

Activating **Info** logs will automatically enable **Warning** and **Error** logs. Enabling **Error** logs will
exclusively
display Error logs. It's worth noting that activating **Trace** logs will generate highly detailed and verbose logs,
primarily intended for advanced troubleshooting. Therefore, it's advisable to use **Trace** and **Debug** log levels
specifically for troubleshooting purposes.

## Console

This section displays logs in the Console, alongside values if a [North Console connector
](../../guide/north-connectors/console) is used. To access these logs, execute OIBus from a terminal.

## File

To store logs in one or more files, you can configure the maximum file size and specify the number of files for log
rotation.

## SQLite

To save logs in a local SQLite database for viewing in the **Logs tab** of OIBus, you can set a **maximum number of logs
**
to prevent the database from becoming overly large. Older entries will be automatically purged.

## Loki

To transmit logs to a remote **Loki** instance, the logs are sent to the designated host in batches at a configurable
time interval (default is 60 seconds). You have the flexibility to adjust this interval to control the batch size.

Loki can be accessed directly using Basic Auth, where you provide a **username** and **password**.

:::caution Loki logs with multiple OIBus
Logs sent to Loki are identified by the OIBus ID. The name is sent alongside the ID. Ensure that you update this name
correctly to locate your OIBus logs within your Loki instance, specially if you have several OIBus.
:::

## OIAnalytics

If OIBus [is registered](./oianalytics-module.md), logs can be forwarded to OIAnalytics. Otherwise, these settings will
be disregarded.
