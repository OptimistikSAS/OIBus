# File Writer

The **File Writer North Connector** writes files to a specified output folder on disk. This connector is useful for
local storage, data processing pipelines, or integration with file-based systems.

It only receives files: the record lists (the OIAnalytics setpoints included) are written into files by a transformer
(e.g. [File](../engine/transformers.mdx#file-from-records)). Before 3.10, it also received records and setpoints:
upgrading writes the rows of the [Records](../engine/transformers.mdx#records-from-file) transformers in JSON files
through [File (as is, renamed or converted)](../engine/transformers.mdx#file-as-is-renamed-or-converted), and removes its custom
transformers sending records or setpoints.

## Specific Settings {#specific-settings}

| Setting           | Description                                                                                                           | Example Value     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Output folder** | Directory where files will be stored. Relative paths are resolved based on the **Data folder** (see _About_ section). | `/data/oibus-out` |

### Network Share Authentication (Windows only) {#network-share-authentication-windows-only}

To write to a Windows network share, set **Output folder** to a UNC path (`\\server\share\...`) and provide credentials
for it:

| Setting          | Description                                                        | Example Value |
| ---------------- | ------------------------------------------------------------------ | ------------- |
| **SMB username** | Username used to authenticate against the network share.           | `svc_oibus`   |
| **SMB password** | Password for the SMB username.                                     | `••••••••`    |
| **SMB domain**   | Domain for the SMB username (optional, e.g. for Active Directory). | `CORP`        |

:::info Windows only
These fields only appear when OIBus runs on Windows. OIBus authenticates an SMB session against the server (`net use`)
before writing, and removes it when the connector disconnects. This does not go through the Windows Credential Manager,
so it also works when OIBus runs as a Windows service, where the interactive-session-only Credential Manager is
unreliable even under an account that otherwise has access to the share.
:::

### File Names {#file-names}

The files are written with the name given by their transformer, without their sub-folder: the **Filename** of the
[File (as is, renamed or converted)](../engine/transformers.mdx#file-as-is-renamed-or-converted) and
[File](../engine/transformers.mdx#file-from-records) transformers (e.g. `@SourceFilename-@CurrentDate@SourceExtension`).

:::info Upgrading to 3.10
Before 3.10, the connector added a **Prefix** and a **Suffix** to the name of the files. Upgrading adds them to the
filename of its transformers, `@ConnectorName` being replaced by the name of the connector (in a transformer,
`@ConnectorName` is the name of the South connector), and renames the files waiting in its cache. A custom transformer
names the files itself.
:::

## Best Practices {#best-practices}

- Use **absolute paths** for the output folder to avoid ambiguity.
- Create a **dedicated directory** for each connector to keep files organized.
- Combine with [transformers](./common-settings#transformers) to:
  - Convert data to other formats (e.g., JSON, CSV).
  - Filter or enrich data before writing.
- Monitor disk space usage, especially when processing large volumes of data.
