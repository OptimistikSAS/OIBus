# Amazon S3™

The **Amazon S3™ North Connector** allows you to store files in **Amazon S3™ (Simple Storage Service)**. It is ideal for
long-term storage, data lakes, or integration with AWS services.

**Example Use Cases**:

- **Data Lake Integration**: Store historical data for analytics or compliance.
- **Backup and Archiving**: Securely archive data from OIBus to Amazon S3.
- **AWS Ecosystem Integration**: Use stored data with AWS services like Athena, Redshift, or Glue.

## Specific Settings

Configure the following parameters to connect to your Amazon S3 bucket:

| Setting        | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| **Bucket**     | Name of the Amazon S3 bucket where files will be stored.        |
| **Region**     | AWS region where the bucket is located (e.g., `eu-west-3`).     |
| **Folder**     | Specific folder within the bucket where files should be stored. |
| **Access key** | Authentication key for connecting to the Amazon S3 bucket.      |
| **Secret key** | Secret key associated with the access key.                      |

### Proxy Configuration

If your OIBus instance requires a proxy to connect to Amazon S3, enable the **Use proxy** option and provide the
following details:

| Setting            | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| **Proxy URL**      | URL of the proxy server (e.g., `http://proxy.example.com:8080`). |
| **Proxy username** | Username for proxy authentication (if required).                 |
| **Proxy password** | Password for proxy authentication (if required).                 |

For more information on proxy configuration, see
the [Engine Settings - Proxy Server Configuration](../engine/engine-settings.mdx#proxy-server).

## Best Practices

- **IAM Permissions**: Ensure the provided access key and secret key have the necessary permissions (e.g.,
  `s3:PutObject`).
- **Monitoring**: Monitor storage usage and costs in the AWS S3 console.
