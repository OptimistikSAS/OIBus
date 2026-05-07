---
sidebar_position: 1
---

# OIBus Launcher

In production, OIBus runs as a **system service**. The service does not start the `oibus` binary directly
— it starts `oibus-launcher`, which then manages `oibus` as a child process.

This indirection is what makes [remote upgrades from OIAnalytics](../installation/oianalytics.mdx) safe:
the launcher can replace the binary, detect a failed start, and roll back automatically — all without
human intervention.

## Component Overview

| Component          | Binary           | Role                                                                                     |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| **OIBus Launcher** | `oibus-launcher` | Managed by the OS service. Handles updates, crash recovery, and child process lifecycle. |
| **OIBus**          | `oibus`          | The main application. Started and monitored by the launcher.                             |

## Folder Structure

The launcher expects the following layout in its working directory (the OIBus installation folder):

```
OIBus/
├── oibus-launcher          ← the launcher binary (run by the OS service)
├── binaries/
│   └── oibus               ← active OIBus binary (oibus.exe on Windows)
├── update/                 ← staged update dropped here by the upgrade process
│   └── binaries/
│       └── oibus
└── backup/                 ← created automatically before an upgrade
    ├── oibus
    └── data-folder/        ← snapshot of the data directory
```

When an upgrade command is received from OIAnalytics, the new binary is placed in `update/binaries/`.
The launcher detects it on the next start.

## Startup Sequence

Every time `oibus-launcher` starts, it follows this sequence:

1. **Check for a staged update** — inspect the `update/` folder for new binaries.

2. **Apply the update** (if files are present):
   - Back up the current binary from `binaries/` and the data folder to `backup/`.
   - Replace the binary in `binaries/` with the one from `update/`.

3. **Start OIBus** — launch `oibus` from `binaries/` as a child process, forwarding all CLI arguments.

4. **Monitor for 30 seconds** — if OIBus exits or crashes within 30 seconds of an update, the launcher
   treats it as a failed upgrade:
   - Stops the crashed process.
   - Restores the previous binary and data folder from `backup/`.
   - Restarts OIBus from the restored binary.

5. **Mark as stable** — if OIBus is still running after 30 seconds, the update is considered successful
   and the backup is cleaned up.

:::info No update found
If the `update/` folder is empty, the launcher skips steps 1–2 and goes directly to step 3.
:::

:::tip Crash recovery
The same monitoring logic applies even without an update. If OIBus crashes for any reason, the launcher
restarts it automatically — behaving like a process supervisor.
:::

## Command-Line Arguments

All arguments passed to `oibus-launcher` (except `--reset-password`) are forwarded to the `oibus` child
process. The launcher also automatically injects `--launcherVersion <version>` so OIBus knows which
launcher version is managing it.

### `--config`

Path to the OIBus data folder. Defaults to `./` if omitted.

```bash
oibus-launcher --config /path/to/OIBusData
```

```batch
oibus-launcher --config C:\OIBusData
```

### `--version`

Print the versions of `oibus-launcher` and `oibus`, then exit. No update check is performed.

```bash
oibus-launcher --version
```

### `--reset-password`

Reset the admin user credentials to the defaults (`admin` / `pass`) and exit immediately.
Always provide `--config` alongside this flag so the launcher finds the correct database.

```bash
oibus-launcher --reset-password --config /path/to/OIBusData
```

**Recovery steps after a forgotten password:**

1. Stop the OIBus service.
2. Run the command above.
3. Restart the service.
4. Log in with `admin` / `pass` and change the password immediately in
   [User Settings](../installation/first-access.mdx#user-settings).

:::caution
`--reset-password` is processed by the launcher only and is never forwarded to the `oibus` binary.
:::
