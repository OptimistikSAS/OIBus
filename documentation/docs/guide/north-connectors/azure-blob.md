# Azure Blob Storage™

The **Azure Blob Storage™ North Connector** allows you to store files in **Microsoft Azure Blob Storage™** or **Azure
Data Lake Storage**. This connector is ideal for cloud storage, data lakes, or integration with Azure services.

**Example Use Cases**:

- **Cloud Data Storage**: Store large volumes of unstructured data cost-effectively.
- **Backup and Archiving**: Securely archive OIBus data in Azure Blob Storage.
- **Azure Ecosystem Integration**: Use stored data with Azure services like Azure Functions, Logic Apps, or Power BI.

## Specific Settings

Configure the following parameters to connect to your Azure Blob Storage:

| Setting            | Description                                                                       | Example Value    |
| ------------------ | --------------------------------------------------------------------------------- | ---------------- |
| **Use Data Lake**  | Enable to use **Azure Data Lake Storage** instead of standard Azure Blob Storage. | Enabled/Disabled |
| **Use custom URL** | Use a custom endpoint URL instead of the account-based standard URL.              | Enabled/Disabled |

### Connection Settings

| Setting        | Description                                                                        | Example Value                                    |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Account**    | Azure storage account name. Used when **Use custom URL** is disabled.              | `mystorageaccount`                               |
| **Custom URL** | Full endpoint URL of the storage service. Used when **Use custom URL** is enabled. | `https://mystorageaccount.blob.core.windows.net` |
| **Container**  | Azure Blob container where files will be stored.                                   | `oibus-data`                                     |
| **Path**       | Folder path within the container where files should be stored.                     | `factory/line1`                                  |

### Authentication

| Setting            | Description                                                                                   | Example Value                                                               |
| ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Authentication** | Authentication method.                                                                        | `Access key`, `SAS token`, `AAD - Application Active Directory`, `External` |
| **Access key**     | Account access key. Required for Access key authentication.                                   | `••••••••`                                                                  |
| **SAS token**      | Shared Access Signature token for time-limited access. Required for SAS token authentication. | `sv=2021-06-08&...`                                                         |
| **Tenant ID**      | Azure Active Directory tenant ID. Required for AAD authentication.                            | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **Client ID**      | Application (client) ID. Required for AAD authentication.                                     | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **Client secret**  | Application client secret. Required for AAD authentication.                                   | `••••••••`                                                                  |

### Proxy Configuration

If your network infrastructure requires requests to pass through a proxy server to reach Azure Blob Storage, enable the
**Use proxy** option and configure the proxy details below.

| Setting            | Description                                      | Example Value                   |
| ------------------ | ------------------------------------------------ | ------------------------------- |
| **Proxy URL**      | URL of the proxy server.                         | `http://proxy.example.com:8080` |
| **Proxy username** | Username for proxy authentication (if required). | `proxy_user`                    |
| **Proxy password** | Password for proxy authentication (if required). | `••••••••`                      |

## Best Practices

- **Monitoring**: Use Azure Monitor to track storage usage, performance, and costs.
