# File Writer

The **File Writer North Connector** writes files and data to a specified output folder on disk. This connector is useful
for local storage, data processing pipelines, or integration with file-based systems.

## Specific Settings

| Setting           | Description                                                                                                           | Example Value     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Output folder** | Directory where files will be stored. Relative paths are resolved based on the **Data folder** (see _About_ section). | `/data/oibus-out` |

### Network Share Authentication (Windows only)

To write to a Windows network share, set **Output folder** to a UNC path (`\\server\share\...`) and provide credentials
for it:

| Setting          | Description                                                        | Example Value |
| ---------------- | ------------------------------------------------------------------ | ------------- |
| **SMB username** | Username used to authenticate against the network share.           | `svc_oibus`   |
| **SMB password** | Password for the SMB username.                                     | `••••••••`    |
| **SMB domain**   | Domain for the SMB username (optional, e.g. for Active Directory). | `CORP`        |

:::info Windows only
These fields only appear when OIBus runs on Windows. OIBus registers the credentials for the share via the Windows
Credential Manager (`cmdkey`) before writing, and removes them when the connector disconnects.
:::

### File Naming Options

| Setting    | Description                                                                                             | Example Value     |
| ---------- | ------------------------------------------------------------------------------------------------------- | ----------------- |
| **Prefix** | Text to prepend to the filename. Supports internal variables like `@ConnectorName`.                     | `@ConnectorName-` |
| **Suffix** | Text to append to the filename (before the extension). Supports internal variables like `@CurrentDate`. | `-@CurrentDate`   |

:::tip Dynamic Filenames
Use internal variables to create dynamic filenames:

- `@ConnectorName`: Inserts the name of the connector.
- `@CurrentDate`: Inserts the current timestamp in `yyyy_MM_dd_HH_mm_ss_SSS` format.

**Example**:
With prefix `@ConnectorName-` and suffix `-@CurrentDate`, a file named `example.file` becomes:
`<ConnectorName>-example-<CurrentDate>.file`
:::

## Best Practices

- Use **absolute paths** for the output folder to avoid ambiguity.
- Create a **dedicated directory** for each connector to keep files organized.
- Combine with [transformers](./common-settings#transformers) to:
  - Convert data to other formats (e.g., JSON, CSV).
  - Filter or enrich data before writing.
- Monitor disk space usage, especially when processing large volumes of data.
