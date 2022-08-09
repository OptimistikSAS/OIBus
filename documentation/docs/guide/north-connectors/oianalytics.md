---
sidebar_position: 2
---

# OIAnalytics

OIAnalytics SaaS application manages both JSON and file payloads. JSON payloads are formatted points retrieved from a 
South point protocol (OPCUA, MQTT) to follow the OIAnalytics API specification.

Files are sent as they are received by the North (compressed or not). OIAnalytics can manage CSV, TXT or XLSX files. There is no need to 
transform these files thanks to OIAnalytics file parsers: the parsing happens directly on the SaaS application thanks 
to its configuration.

To send data (JSON or files) to OIAnalytics, the following fields must be filled:
- **Host**: the hostname of the SaaS application (example: `https://optimistik.oianalytics.com`)
- **Authentication type**: only _Basic_ is supported by OIAnalytics
- **Username**: the username to connect to
- **Password**: the password associated to the username

The user used to send data to OIAnalytics must have the API access, since the data will be sent through the API. The API
**does not use standard login and password**. Instead, an API key must be created on OIanalytics:
- Go to Configuration -> Users and click on the key icon of the user you want to create an API key to.
- Create an API key to generate a new API. Copy and store the key and its password somewhere safe.
- Use the key for username, and the password in OIBus

![OIAnalytics API Key gen](@site/static/img/guide/north/oianalytics/oia-api-key-gen.png)

:::danger Password retrieval

The API key generation is the only time you will be able to copy the password. If you loose it, a new API key must be 
generated.

:::

:::tip API user

We suggest to create a dedicated API user in OIAnalytics (with only API access) and to give each OIBus a dedicated API 
key, in case one of the key should be revoked.

:::
