---
sidebar_position: 5
---

# Azure Blob
The Azure Blob North connector is used to write files received from South connectors to a designated Azure Blob container.

## Specific settings
Here are the key parameters for configuring the Azure Blob connector:
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
