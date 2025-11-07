# SFTP

The **SFTP North Connector** securely uploads files and data to an **SFTP (SSH File Transfer Protocol) server**.

## Specific Settings

| Setting  | Description                                |
| -------- | ------------------------------------------ |
| **Host** | IP address or hostname of the SFTP server. |
| **Port** | Port for the connection (default: **22**). |

### Authentication Methods

| Method                | Description                                      | Required Parameters                               |
| --------------------- | ------------------------------------------------ | ------------------------------------------------- |
| **Username/Password** | Standard username/password authentication.       | Username, Password                                |
| **Private Key**       | Authentication using a private key (PEM format). | Username, Private Key Path, (Optional) Passphrase |

### File Configuration

| Setting           | Description                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| **Remote folder** | Directory on the SFTP server where files will be stored.                                                |
| **Prefix**        | Text to prepend to the filename. Supports internal variables like `@ConnectorName`.                     |
| **Suffix**        | Text to append to the filename (before the extension). Supports internal variables like `@CurrentDate`. |

:::tip Dynamic Filenames
Use internal variables to create dynamic filenames:

- `@ConnectorName`: Inserts the name of the connector.
- `@CurrentDate`: Inserts the current timestamp in `yyyy_MM_dd_HH_mm_ss_SSS` format.

**Example**:
With prefix `@ConnectorName-` and suffix `-@CurrentDate`, a file named `example.file` becomes:
`<ConnectorName>-example-<CurrentDate>.file`
:::
