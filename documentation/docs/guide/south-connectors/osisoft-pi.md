---
sidebar_position: 16
---

# OSIsoft PI

OSIsoft PI is a software platform used for collecting, and visualizing data from industrial operations. These data
can be retrieved through the OSIsoft PI driver embedded in our [OIBus Agent](../oibus-agent/installation.mdx), in a
dedicated PI module.

:::caution
The OIBus Agent must be installed on a Windows machine to use the PI module.
:::

## Specific settings

OIBus exchanges commands and data with the PI Agent through an HTTP communication. Therefore, several
fields must be filled to make OIBus communicate with the PI Agent:

- **Remote agent URL**: Specify the URL of the remote OIBus agent, e.g., http://ip-address-or-host:2224.
- **Retry interval**: Time to wait before retrying connection.

## Item settings

When configuring each item to retrieve data in JSON payload, you'll need to specify the following specific settings:

- **Type**: pointId to access a point through its fully qualified ID, or pointQuery to access a list of points that
- **Point ID**: The fully qualified ID of the point (without the server name)
- **Point Query**: A selector to access multiple points at once.
  See [this documentation](https://docs.aveva.com/bundle/af-sdk/page/html/pipoint-query-syntax-overview.htm#Examples)
  for example.

The name of the item will serve as a reference in JSON payloads if the type is pointId. For pointQuery items, the PI
name will be used as reference. 