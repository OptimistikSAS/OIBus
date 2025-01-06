---
sidebar_position: 5
---

# Azure Blob Storage™

Store files in Microsoft Azure Blob Storage™.

## Specific settings

Here are the key parameters for configuring the Azure Blob connector:

- **Use Data Lake**: Use Azure Data Lake Storage instead of Azure Blob Storage.
- **Use custom URL**: Use a custom URL to access your instance. Otherwise, a standard URL will be used (for Azure Blob
  Storage, it would be `https://<acount>.dfs.core.windows.net`).
- **Account**: The Azure account to use. This account must have access to the specified container.
- **Container**: The Azure Blob container where files will be stored.
- **Path**: The folder within the container where files should be stored.
- **Authentication**: The method of authentication used to connect to the Azure Blob container.
    - **Access Key**: Connect to the account using an access key.
    - **SAS Token**: Use a Shared Access Signature Token to connect to the account.
    - **AAD (Application Active Directory)**: Requires a service account in Azure.
        - **Tenant ID**: The Azure account's tenant ID.
        - **Client ID**: An ID associated with the service account.
        - **Client Secret**: The secret associated with the client ID.
    - External (Windows only): Utilize Windows domain authentication.
- **Use proxy**: Choose whether to route the request through a proxy.
    - **Proxy URL**: The URL of the proxy server to pass through.
    - **Proxy username**: The username associated with the proxy.
    - **Proxy password**: The password linked to the proxy.

## OIBus Time values

OIBus time values are converted into CSV format before being sent to Azure Blob Storage. 
