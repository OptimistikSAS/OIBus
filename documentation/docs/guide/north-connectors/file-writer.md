# File Writer

The **File Writer North Connector** writes files and data to a specified output folder on disk. This connector is useful
for local storage, data processing pipelines, or integration with file-based systems.

## Specific Settings

| Setting           | Description                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Output folder** | Directory where files will be stored. Relative paths are resolved based on the **Data folder** (see _About_ section). |

### File Naming Options

| Setting             | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Prefix filename** | Text to prepend to the filename. Supports internal variables like `@ConnectorName`.                     |
| **Suffix filename** | Text to append to the filename (before the extension). Supports internal variables like `@CurrentDate`. |

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
