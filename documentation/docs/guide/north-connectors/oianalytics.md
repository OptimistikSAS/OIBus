---
sidebar_position: 1
---

# OIAnalytics®

Send files and values to OIAnalytics®.

The OIAnalytics SaaS application is equipped to handle both JSON and file payloads. JSON payloads consist of formatted
data points obtained from various South point protocols such as OPCUA and MQTT.

Files, on the other hand, are transmitted exactly as they are received by the North connector, whether compressed or
not.
OIAnalytics has the capability to manage various file formats, including CSV, TXT, and XLSX. OIAnalytics offers the
advantage
of its built-in file parsers, alleviating the necessity for any pre-processing of data. The parsing process seamlessly
unfolds within the SaaS application, courtesy of its easily configurable settings.

## Settings

Here are the important parameters for configuring connectivity with the OIAnalytics SaaS application:

- **Use OIAnalytics registration**: Use the connection settings of the [OIAnalytics registration](../advanced/oianalytics-registration.mdx).
- **Timeout**: The duration before a connection failure is reported in HTTP requests.
- **Compress data**: Compress the data if not already compressed. Compressed files will be detected with the .gz file
  extension,
  and JSON payload will be compressed and sent to a specific OIAnalytics endpoint.

If OIAnalytics registration is not used, the following fields will be used:

- **Host**: The hostname of the SaaS application (e.g., `https://optimistik.oianalytics.com`).
- **Accept unauthorized certificate**: This option is useful when HTTP queries traverse a firewall that strips the
  certificate.
- **Authentication**:
    - **Basic Auth**:
        - Access key: Provide the access key used for authentication.
        - Secret key: Enter the secret key used for authentication.
    - **Azure Active Directory with client secret**:
        - Tenant ID
        - Client ID
        - Client secret
    - **Azure Active Directory with certificate**:
        - Tenant ID
        - Client ID
        - Certificate
        - Scope
- **Use proxy**: Choose whether to route the request through a proxy.
    - **Proxy URL**: The URL of the proxy server to pass through.
    - **Proxy username**: The username associated with the proxy.
    - **Proxy password**: The password linked to the proxy.

## OIAnalytics access
### Best Practice for Connecting OIBus to OIAnalytics
To securely connect OIBus to OIAnalytics, follow these steps:
1. Register OIBus on OIAnalytics:
    - This ensures seamless integration and secure communication between OIBus and OIAnalytics.
2. Enable the **Use OIAnalytics registration** option:
   - In the North connector settings, enable the **Use OIAnalytics registration** option to establish the connection.
   - By doing this, you eliminate the need to manually transfer API keys, simplifying the process and enhancing security.

:::tip Proxy client
If you want to pass data through a proxy, be sure to set the proxy in the 
[OIAnalytics registration](../advanced/oianalytics-registration.mdx).
:::

### Alternative Approach: Obtaining an API Key
If you choose not to register OIBus on OIAnalytics, you can still connect by obtaining an API Key. Here’s how.

Data sent to OIAnalytics is transmitted through the OIAnalytics public API. API access in OIAnalytics is linked to a
user account. Instead of conventional login credentials, an API key must be established within OIAnalytics using the
following steps:

1. Navigate to Configuration -> Users.
2. Locate the user for whom you intend to generate an API key, and click on the key icon.
3. Create an API key to generate a new API key. Be sure to copy and securely store both the key and its associated
   password.
4. In OIBus, fill the API key and the associated secret key.

![OIAnalytics API Key gen](../../../static/img/guide/north/oianalytics/oia-api-key-gen.png)

:::danger Password retrieval
It's crucial to emphasize that the API key generation is the only opportunity to access and copy the password associated
with it. If you happen to lose this password, you will need to generate a new API key in order to obtain it.
:::

:::tip API user
We recommend creating a dedicated API user in OIAnalytics with exclusive API access. It's advisable to assign a unique
API key to each OIBus instance. This approach offers the advantage of easier key management, allowing you to revoke a
specific API key if necessary without affecting other instances.
:::

## OIBus Time values

OIBus time values are sent as JSON payloads to OIAnalytics. It does not use file parser, but directly look for external
references in time values. 
