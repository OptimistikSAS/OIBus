---
sidebar_position: 4
---

# AWS S3
The AWS S3 North connector is designed to write files received from South connectors to the designated AWS S3 bucket.

## Specific settings
Here are the essential parameters for configuring the AWS S3 connector:

- **Bucket**: The name of the AWS S3 bucket.
- **Region**: The region where the bucket is located (e.g., `eu-west-3`).
- **Folder**: The specific folder within the bucket where files should be stored.
- **Access key**: The authentication key used for connecting to the Amazon S3 bucket.
- **Secret key**: The secret key associated with the access key.
- **Use proxy**: An option to utilize a proxy for sending HTTP requests.
- **Proxy URL**: The URL of the proxy server to pass requests through.
- **Proxy username**: The username linked to the proxy.
- **Proxy password**: The password associated with the proxy username.
