---
sidebar_position: 3
---

# SFTP

Read files from a remote SFTP server.

## Specific settings

- **Host**: IP address or hostname of the SFTP server.
- **Port**: The port to use for connection (8080 by default).
- **Authentication**:
  - Password: The username and password
  - Private key: The username and the path of the private key (PEM format). A passphrase can be used with the private key.
- **Compress file**: If enabled, files are compressed using gzip locally before being sent into the North caches.

## Item settings

- **Remote folder**: This is the directory where files will be stored.
- **RegExp**: You can use a Regular Expression to selectively retrieve files that match a specific pattern. Here are some examples:
  - `.*` retrieves all files in the input folder.
  - `.*.txt` retrieves all text files (with a .txt extension) in the input folder.
  - `.*.csv` retrieves all CSV files in the input folder.
  - `.csv||.xlsx` retrieves all files with either a .csv or .xlsx extension in the input folder.
- **Minimum age**: This field is used to set a minimum age for retrieved files. It helps avoid retrieving potentially corrupted files that
  are still being written. By default, OIBus retrieves files that have been written for at least one second.
- **Preserve file**: When enabled, retrieved files are kept in the folder. This can be useful when another application needs access to these
  files. The **Preserve file** feature lists all retrieved files in the cache, along with their last modification time. If the modification
  time remains unchanged, the file is ignored. Otherwise, the file is retrieved again.
- **Ignored modified date** (_Preserve file_ must be enabled): This option forces the retrieval of a file, even if its modification time
  hasn't changed since the last retrieval. It is useful in situations where you want to ensure that the file is always retrieved.

:::info Regex testing
To check your regular expressions, you can utilize a tool like https://regex101.com/.
:::
