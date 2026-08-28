# REST API

The **REST API North Connector** enables OIBus to **send data to any HTTP REST endpoint**, making it ideal for
integrating with custom APIs, webhooks, and cloud services that accept JSON payloads or file uploads.

OIBus can transmit:

- **Time-value payloads**: Serialized as a JSON body or a JSON file sent via FormData.
- **Files**: Forwarded as-is (compressed or uncompressed) via FormData.

**Example Use Cases**:

- **Custom API Integration**: Push OIBus data directly to an internal or third-party REST API.
- **Webhook Delivery**: Trigger external systems with event-driven HTTP calls.
- **Cloud Ingestion**: Forward data to cloud platforms that expose an HTTP ingest endpoint.

## Specific Settings {#specific-settings}

### Connection Configuration {#connection-configuration}

| Setting                             | Description                                                                                  | Example Value             |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| **Host**                            | Base URL of the REST API server. Must start with `http://` or `https://`.                    | `https://api.example.com` |
| **Accept unauthorized certificate** | Accept self-signed or otherwise untrusted TLS certificates.                                  | Enabled/Disabled          |
| **Method**                          | HTTP method used when sending data.                                                          | `POST`, `PUT`, `PATCH`    |
| **Endpoint**                        | Path appended to the host to form the full request URL.                                      | `/api/data`               |
| **Request timeout**                 | Maximum time (in seconds) to wait for a response before the request is considered failed.    | `30`                      |
| **Send payload as**                 | How the payload is sent: as a raw **Body** or as a **File (FormData)** multipart attachment. | `Body`                    |
| **Expected success code**           | HTTP status code that indicates a successful transmission.                                   | `200`                     |

:::tip Send payload as

- **Body**: The payload (JSON or file content) is sent directly as the request body. OIBus sets the `Content-Type`
  header automatically based on the file extension (`.json`, `.xml`, `.txt`, `.csv`).
- **File (FormData)**: The payload is attached as a file in a `multipart/form-data` request. Use this when the API
  expects a file upload rather than a raw body.
  :::

### Authentication {#authentication}

| Setting          | Description                                                                                                                                    | Example Value                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Type**         | Authentication method.                                                                                                                         | `None`, `Basic (username/password)`, `Bearer token`, `API key` |
| **Username**     | Username. Required for Basic authentication.                                                                                                   | `api_user`                                                     |
| **Password**     | Password used with Basic authentication (leave blank when editing to keep the existing password).                                              | `••••••••`                                                     |
| **Bearer token** | Token sent in the `Authorization: Bearer` header, used with Bearer token authentication (leave blank when editing to keep the existing token). | `••••••••`                                                     |
| **API key**      | Name of the API key parameter. Required for API key authentication.                                                                            | `X-API-Key`                                                    |
| **API value**    | Value of the API key, used with API key authentication (leave blank when editing to keep the existing value).                                  | `••••••••`                                                     |
| **Add to**       | Where to attach the API key: `Header` or `Query parameters`. Required for API key.                                                             | `Header`                                                       |

### Proxy Configuration {#proxy-configuration}

If your network infrastructure requires requests to pass through a proxy server to reach the target REST API, enable
the **Use proxy** option and configure the proxy details below.

| Setting            | Description                                      | Example Value                   |
| ------------------ | ------------------------------------------------ | ------------------------------- |
| **Use proxy**      | Route requests through a proxy server.           | Enabled/Disabled                |
| **Proxy URL**      | URL of the proxy server.                         | `http://proxy.example.com:8080` |
| **Proxy username** | Username for proxy authentication (if required). | `proxy_user`                    |
| **Proxy password** | Password for proxy authentication (if required). | `••••••••`                      |

### Query Parameters {#query-parameters}

Add static query parameters appended to every request URL. Each entry has a **Key** and a **Value**.

| Field     | Description            | Example Value |
| --------- | ---------------------- | ------------- |
| **Key**   | Query parameter name.  | `source`      |
| **Value** | Query parameter value. | `oibus`       |

### Headers {#headers}

Add custom HTTP headers sent with every request. Each entry has a key name and a value.

| Field                    | Description        | Example Value     |
| ------------------------ | ------------------ | ----------------- |
| **HTTP header key name** | HTTP header name.  | `X-Custom-Header` |
| **HTTP header value**    | HTTP header value. | `my-value`        |

:::info Authentication headers
Headers set in the **Headers** section are merged with any headers generated by the authentication configuration.
Authentication headers (e.g., `Authorization`) take precedence if the same header name is defined in both places.
:::

## Connection Test {#connection-test}

Use the **Connection Test** section to verify connectivity before OIBus starts sending real data.

| Setting                   | Description                                                                          | Example Value |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------- |
| **Method**                | HTTP method used for the test request.                                               | `GET`         |
| **Test Endpoint**         | Path used for the test request (appended to the configured **Host**).                | `/health`     |
| **Body**                  | JSON body sent with the test request. Only available when method is `POST` or `PUT`. | `{}`          |
| **Expected success code** | HTTP status code that indicates a successful test response.                          | `200`         |

The test uses the same host, authentication, and proxy settings as the live configuration. It does **not** reuse the
configured query parameters or headers — those are only sent with real data.
