---
sidebar_position: 2
---

# Logging parameters
OIBus logs have five levels (from the most to the less critical):
- Error
- Warning
- Info
- Debug
- Trace

Activating _**Info**_ logs will also activate _**Warning**_ and _**Error**_ logs. Activating _**Error**_ logs will only 
display _**Error**_ logs. 
Obviously, having _**Trace**_ logs activated will result in extremely verbose logs. Use _**Trace**_ and _**Debug**_ for 
troubleshooting purposes.

## Console
This section displays the logs in the Console, alongside values if a [North Console connector
](docs/guide/north-connectors/console.md) is used. 

## File
To store logs in one or several files. You can choose the file maximum size and the number of files to roll logs.

## SQLite
To store logs in a local SQLite database to be displayed in the _Logs tab_ of OIBus.

## Loki
To send the logs to a remote _loki_ instance. Logs are sent to the specified host, in batches a tunable time period 
(default is 60s). You can change this period to have smaller or bigger batches of logs.

Loki can be accessed directly by _username_ and _password_ using Basic Auth. If a JWT token should be retrieved first, 
fill the _Token address_ to use to retrieve the token, using Basic Auth (with the username and password). 
The token will be used by OIBus to send logs to the remote _loki_ instance. Keep the token address empty if you 
don't use JWT token authentication.

:::caution Loki logs with multiple OIBus

Logs sent to loki are identified by the OIBus engine name. Be sure to update this name appropriately to find your OIBus
logs in your loki instance.

:::
