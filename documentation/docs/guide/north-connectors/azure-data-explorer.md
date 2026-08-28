# Azure Data Explorer™

The **Azure Data Explorer™ North Connector** ingests OIBus data into an **Azure Data Explorer (Kusto)** cluster,
database and table, using Microsoft's official SDKs via **queued ingestion**. It is OIBus's first North connector in
the **database** category.

**Example Use Cases**:

- **Time-Series Analytics at Scale**: Store large volumes of industrial time-series data for fast, scalable
  analytics.
- **Ad-Hoc KQL Querying**: Explore and query industrial data interactively using the Kusto Query Language (KQL).
- **Dashboards and Reporting**: Feed Power BI or Azure dashboards directly from Azure Data Explorer.
- **Historian Offload**: Use Azure Data Explorer as a long-term, low-cost historian for OIBus data.

## Specific Settings {#specific-settings}

Configure the following parameters to connect to your Azure Data Explorer cluster:

| Setting                    | Description                                                                                                                                                                                               | Example Value                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Cluster URL**            | Engine endpoint of the Azure Data Explorer cluster. Enter the plain cluster URL, not the `ingest-` endpoint: the connector automatically derives the ingestion (`ingest-`) endpoint from it.              | `https://mycluster.westeurope.kusto.windows.net` |
| **Database**               | Name of the Azure Data Explorer database to ingest into.                                                                                                                                                  | `oibus`                                          |
| **Table**                  | Name of the target table to ingest into. The table must already exist in Azure Data Explorer.                                                                                                             | `TimeValues`                                     |
| **Data format**            | Format used to send data to Azure Data Explorer. Must match the transformer selected on this connector.                                                                                                   | `CSV`, `JSON`, `Multiline JSON`                  |
| **Ingestion mapping name** | Name of a pre-created Azure Data Explorer ingestion mapping used to map columns. Optional; must already exist in Azure Data Explorer. When empty, Azure Data Explorer uses its default column resolution. | `TimeValuesMapping`                              |

### Authentication {#authentication}

Azure Data Explorer supports three authentication modes:

| Setting            | Description                                                                                                                 | Example Value                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Authentication** | Authentication method.                                                                                                      | `AAD application secret`, `AAD application certificate`, `Managed identity` |
| **Tenant ID**      | Azure Active Directory tenant ID. Required for `AAD application secret` and `AAD application certificate`.                  | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **Client ID**      | Application (client) ID. Required for `AAD application secret` and `AAD application certificate`.                           | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **Client secret**  | Application client secret. Required for `AAD application secret`.                                                           | `••••••••`                                                                  |
| **Certificate**    | Certificate to use for authentication, selected from OIBus's certificate store. Required for `AAD application certificate`. | `my-adx-certificate`                                                        |

With `Managed identity`, no credentials are required: OIBus authenticates using the ambient Azure managed identity of
the host it runs on (for example an Azure VM or App Service with a system- or user-assigned managed identity).

### Proxy {#proxy}

If your network infrastructure requires requests to pass through a proxy server to reach Azure Data Explorer, enable
the **Use proxy** option and configure the proxy details below.

| Setting            | Description                                      | Example Value                   |
| ------------------ | ------------------------------------------------ | ------------------------------- |
| **Proxy URL**      | URL of the proxy server.                         | `http://proxy.example.com:8080` |
| **Proxy username** | Username for proxy authentication (if required). | `proxy_user`                    |
| **Proxy password** | Password for proxy authentication (if required). | `••••••••`                      |

Proxy support is partial. The Azure Data Explorer SDK exposes no proxy option, so OIBus installs the proxy directly on
the SDK's HTTP clients, and also passes it to the Entra ID (`@azure/identity`) credentials used to authenticate. This
covers the Azure Data Explorer calls themselves — management commands (including **Test settings**) and ingestion
resource discovery — as well as the token requests made to Entra ID to acquire and refresh credentials.

It does **not** cover the payload upload: queued ingestion uploads the file through the Azure Storage SDK, which does
not honour this setting. If those uploads must also go through the proxy, set `HTTPS_PROXY` at the OS level in addition
to configuring the proxy here.

## Important Notes {#important-notes}

- **Data format must match the transformer**: use the `oibus-time-values-to-csv` transformer with the `CSV` data
  format, or the `oibus-time-values-to-json` transformer with the `JSON` or `Multiline JSON` data format. A mismatch
  between the transformer and the data format causes ingestion failures on the Azure Data Explorer side.
- **Ingestion is queued, not streaming**: Azure Data Explorer accepts the batch and completes ingestion
  asynchronously, so rows become queryable only after Azure Data Explorer's own batching latency (by default up to
  around 5 minutes, governed by the target table's ingestion batching policy). A successful send in OIBus means the
  data was accepted for ingestion, not that it is immediately queryable.
- **Schema must pre-exist**: the target table and any ingestion mapping must be created in Azure Data Explorer
  beforehand. This connector does not create or alter schema.

## Testing the connection {#testing-the-connection}

The **Test settings** action runs a lightweight `.show table … cslschema` management command against the configured
cluster, database and table. This verifies cluster reachability, authentication, and that the target table exists,
without ingesting any data.
