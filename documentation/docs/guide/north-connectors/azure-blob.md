# Azure Blob Storage™

The **Azure Blob Storage™ North Connector** allows you to store files in **Microsoft Azure Blob Storage™** or **Azure
Data Lake Storage**. This connector is ideal for cloud storage, data lakes, or integration with Azure services.

**Example Use Cases**:

- **Cloud Data Storage**: Store large volumes of unstructured data cost-effectively.
- **Backup and Archiving**: Securely archive OIBus data in Azure Blob Storage.
- **Azure Ecosystem Integration**: Use stored data with Azure services like Azure Functions, Logic Apps, or Power BI.

## Specific Settings

Configure the following parameters to connect to your Azure Blob Storage:

| Setting            | Description                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Use Data Lake**  | Enable to use **Azure Data Lake Storage** instead of standard Azure Blob Storage.                             |
| **Use custom URL** | Use a custom endpoint URL. If disabled, the standard URL (`https://<account>.blob.core.windows.net`) is used. |

### Connection Settings

| Setting       | Description                                                        |
| ------------- | ------------------------------------------------------------------ |
| **Account**   | Azure storage account name with access to the specified container. |
| **Container** | Azure Blob container where files will be stored.                   |
| **Path**      | Folder path within the container where files should be stored.     |

### Authentication Methods

Choose one of the following authentication methods:

| Method         | Description                                                                         | Required Parameters                 |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| **Access Key** | Connect using an account access key.                                                | Account access key                  |
| **SAS Token**  | Use a **Shared Access Signature (SAS) Token** for time-limited access.              | SAS Token                           |
| **AAD**        | Use **Azure Active Directory** authentication. Requires a service account in Azure. | Tenant ID, Client ID, Client Secret |
| **External**   | Use **Windows domain authentication** (Windows only).                               |                                     |

### Proxy Configuration

If your OIBus instance requires a proxy to connect to Azure Blob Storage, enable the **Use proxy** option and provide
the following details:

| Setting            | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| **Proxy URL**      | URL of the proxy server (e.g., `http://proxy.example.com:8080`). |
| **Proxy username** | Username for proxy authentication (if required).                 |
| **Proxy password** | Password for proxy authentication (if required).                 |

For more information on proxy configuration, see
the [Engine Settings - Proxy Server Configuration](../engine/engine-settings.mdx#proxy-server).

## Best Practices

- **Monitoring**: Use Azure Monitor to track storage usage, performance, and costs.
