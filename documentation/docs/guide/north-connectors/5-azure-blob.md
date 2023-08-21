---
sidebar_position: 5
---

# Azure Blob
The Azure Blob connector writes files received from South connectors to the specified Azure Blob container.

## Specific settings
- **Account**: Account to use. The account must have access to the container
- **Container**: Container to use to store the files
- **Path**: The folder to store the files to
- **Authentication**: the authentication key used to connect to Amazon S3 bucket
  - **Access Key**: Connect to the account with an access key
  - **SAS Token**: The Shared Access Signature Token to connect to the account
  - **External** (Windows only): Use the Windows domain authentication
  - **Powershell** (Windows only): Use the Windows Powershell environment variables to authenticate
  - **AAD**:
    - Tenant ID
    - Client ID
    - Client Secret
  
