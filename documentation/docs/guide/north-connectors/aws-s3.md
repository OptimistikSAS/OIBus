---
sidebar_position: 4
---

# Amazon S3™

Store files in Amazon S3™ (Simple Storage Service)

## Specific settings

Here are the essential parameters for configuring the Amazon S3 connector:

- **Bucket**: The name of the Amazon S3 bucket.
- **Region**: The region where the bucket is located (e.g., `eu-west-3`).
- **Folder**: The specific folder within the bucket where files should be stored.
- **Access key**: The authentication key used for connecting to the Amazon S3 bucket.
- **Secret key**: The secret key associated with the access key.
- **Use proxy**: An option to utilize a proxy for sending HTTP requests.
    - **Proxy URL**: The URL of the proxy server to pass requests through.
    - **Proxy username**: The username linked to the proxy.
    - **Proxy password**: The password associated with the proxy username.

## OIBus Time values

OIBus time values are converted into CSV format before being sent to Amazon S3.