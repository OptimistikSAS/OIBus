---
sidebar_position: 1
---

# OIBus Launcher

In production, OIBus is installed and runs as a **service** (via installation scripts or the Windows installer). The system consists of two main components:

- **OIBus Launcher** (`oibus-launcher`)
- **OIBus Binary** (`oibus`)

The service executes the OIBus Launcher, which manages the OIBus binary as a child process. This architecture is particularly useful for handling **[remote updates from OIAnalytics](../installation/oianalytics.mdx)**.

## How the OIBus Launcher Works

When you start the `oibus-launcher`, it follows this process:

1. **Check for Updates**

The launcher checks the `update` folder for new files (e.g., from a remote update).

2. **Backup and Update**

If files are found:

- It creates a backup of the current binaries and the `data-folder` (e.g., `C:\OIBusData`).
- It replaces the existing files in the `binaries` folder with the updated ones.

3. **Launch OIBus**

The launcher starts the `oibus` binary as a child process.

5. **Monitor for Failures**

The launcher monitors the child process for **30 seconds**. If the process fails (indicating a potential update failure), it:

- Stops the child process.
- Restores both the binaries and the data folder from the backup.
- Restarts the `oibus` binary.

6. **Direct Boot (No Updates)**

If no files are found in the `update` folder, the launcher directly starts the `oibus` binary from the `binaries` folder.

## Console Line Arguments

All command-line arguments passed to `oibus-launcher` are forwarded to the `oibus` child process.

### `--config`

Run the `oibus` binary with the specified data folder.

```bash
oibus-launcher --config C:\OIBusData
```

### `--version`

Display the versions of `oibus` and `oibus-launcher`, then exits.

```bash
oibus-launcher --version true
```

### `--reset-password`

Reset the admin user credentials to their default values (`admin` / `pass`).

**Steps:**

1. Run the command:
   ```bash
   oibus-launcher --reset-password true --config C:\OIBusData
   ```
2. Restart the service.
3. Access the OIBus interface using the default credentials: `admin` / `pass`.

:::caution
Always specify the data folder path when using `--reset-password`.
:::
