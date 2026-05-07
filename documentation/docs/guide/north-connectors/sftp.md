# SFTP

The **SFTP North Connector** securely uploads files and data to an **SFTP (SSH File Transfer Protocol) server**.

## Specific Settings

| Setting  | Description                                | Example Value   |
| -------- | ------------------------------------------ | --------------- |
| **Host** | IP address or hostname of the SFTP server. | `192.168.1.100` |
| **Port** | Port for the connection (default: `22`).   | `22`            |

### Authentication

| Setting            | Description                                                               | Example Value                      |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------------- |
| **Authentication** | Authentication method.                                                    | `Username/Password`, `Private key` |
| **Username**       | Username for the SFTP server.                                             | `sftp_user`                        |
| **Password**       | Password. Required for Username/Password authentication.                  | `••••••••`                         |
| **Private key**    | Path to the private key file (PEM format). Required for Private key auth. | `/path/to/key.pem`                 |
| **Passphrase**     | Passphrase for the private key (if protected).                            | `••••••••`                         |

### File Configuration

| Setting            | Description                                                                                             | Example Value     |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ----------------- |
| **Remote folder** | Directory on the SFTP server where files will be stored.                                                | `/data/oibus`     |
| **Prefix**        | Text to prepend to the filename. Supports internal variables like `@ConnectorName`.                     | `@ConnectorName-` |
| **Suffix**        | Text to append to the filename (before the extension). Supports internal variables like `@CurrentDate`. | `-@CurrentDate`   |

:::tip Dynamic Filenames
Use internal variables to create dynamic filenames:

- `@ConnectorName`: Inserts the name of the connector.
- `@CurrentDate`: Inserts the current timestamp in `yyyy_MM_dd_HH_mm_ss_SSS` format.

**Example**:
With prefix `@ConnectorName-` and suffix `-@CurrentDate`, a file named `example.file` becomes:
`<ConnectorName>-example-<CurrentDate>.file`
:::
