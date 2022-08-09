---
sidebar_position: 6
---

# Health signal
A message can be sent regularly to the logs or to an HTTP endpoint to give information about OIBus status.

## Log
When enabled, the health signal is sent to the logs with an `info` criticality, at the desired frequency. It will be 
sent to the appropriate channels (console, file, SQLite, loki...) according to the
[logging settings](docs/guide/engine/logging-parameters.md).

## HTTP
It is also possible to send the OIBus health signal to a remote HTTP endpoint as a JSON payload:

````json
{
      "version": "OIBus version",
      "architecture": "OS architecture",
      "executable": "path to the OIBus binary",
      "processId": "Process ID",
      "hostname": "OS hostname",
      "osRelease": "OS release",
      "osType": "OS type",
      "id": "OIBusName"
    }
````

To do so, activate the HTTP signal and fill in the following fields:
- **Host**: the hostname or IP address
- **Endpoint**: endpoint that will receive the JSON payload
- **Frequency**: time interval between HTTP signals (in s)
- **Proxy**: select a proxy to use if needed
- **Verbose**: to have more details about the status of OIBus

Also fill in the authentication section according to the authentication method used in the target endpoint.
