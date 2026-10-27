# SFTP

The **SFTP North Connector** securely uploads files and data to an **SFTP (SSH File Transfer Protocol) server**.

## Specific Settings {#specific-settings}

| Setting  | Description                                | Example Value   |
| -------- | ------------------------------------------ | --------------- |
| **Host** | IP address or hostname of the SFTP server. | `192.168.1.100` |
| **Port** | Port for the connection (default: `22`).   | `22`            |

### Authentication {#authentication}

| Setting            | Description                                                               | Example Value                      |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------------- |
| **Authentication** | Authentication method.                                                    | `Username/Password`, `Private key` |
| **Username**       | Username for the SFTP server.                                             | `sftp_user`                        |
| **Password**       | Password. Required for Username/Password authentication.                  | `••••••••`                         |
| **Private key**    | Path to the private key file (PEM format). Required for Private key auth. | `/path/to/key.pem`                 |
| **Passphrase**     | Passphrase for the private key (if protected).                            | `••••••••`                         |

### File Configuration {#file-configuration}

| Setting           | Description                                              | Example Value |
| ----------------- | -------------------------------------------------------- | ------------- |
| **Remote folder** | Directory on the SFTP server where files will be stored. | `/data/oibus` |

The files are written with the name given by their transformer, without their sub-folder: the **Filename** of the
[File (as is, renamed or converted)](../engine/transformers.mdx#file-as-is-renamed-or-converted) and
[File](../engine/transformers.mdx#file-from-records) transformers (e.g. `@SourceFilename-@CurrentDate@SourceExtension`).

:::info Upgrading to 3.10
Before 3.10, the connector added a **Prefix** and a **Suffix** to the name of the files. Upgrading adds them to the
filename of its transformers, `@ConnectorName` being replaced by the name of the connector (in a transformer,
`@ConnectorName` is the name of the South connector), and renames the files waiting in its cache. A custom transformer
names the files itself.
:::
