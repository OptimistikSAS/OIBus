---
sidebar_position: 3
---

# SFTP

Upload files and data to an SFTP server.

## Specific settings

- **Host**: IP address or hostname of the SFTP server machine.
- **Port**: The port to use for connection (8080 by default).
- **Authentication**:
  - Password: The username and password
  - Private key: The username and the path of the private key (PEM format). A passphrase can be used with the private key.
- **Remote folder**: This is the directory where files will be stored.
- **Prefix**: You can include a prefix to be added to the filename.
- **Suffix**: You have the option to append a suffix to the filename, which appears just before the file extension.

:::tip
Prefix and suffix options can incorporate the internal variables `@ConnectorName` and `@CurrentDate`. For instance, when using
`@ConnectorName-` as a prefix and `-@CurrentDate` as a suffix, a filename like _example.file_ will result in an output format of
`<ConnectorName>-example-<CurrentDate>.file`, where `<CurrentDate>` will be replaced with the current date and time in the
**yyyy_MM_dd_HH_mm_ss_SSS** format.
:::

## OIBus Time values

OIBus time values are converted into CSV format before being sent to the SFTP server.
