---
sidebar_position: 5
---

# OIBus Launcher

在生产环境中，OIBus 以**系统服务**的形式运行。该服务并不直接启动 `oibus` 二进制文件
——而是启动 `oibus-launcher`，由它负责将 `oibus` 作为子进程进行管理。

正是这层间接机制使得[从 OIAnalytics 进行远程升级](../installation/oianalytics.mdx)变得安全：
launcher 可以替换二进制文件、检测启动失败，并在无需人工干预的情况下自动回滚。

## 组件概览 {#component-overview}

| 组件                | 二进制文件        | 角色                                                                                     |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| **OIBus Launcher** | `oibus-launcher` | 由操作系统服务管理，负责更新、崩溃恢复以及子进程的生命周期管理。 |
| **OIBus**          | `oibus`          | 主应用程序，由 launcher 启动并监控。                             |

## 文件夹结构 {#folder-structure}

launcher 期望在其工作目录（即 OIBus 安装文件夹）中具有以下布局：

```
OIBus/
├── oibus-launcher          ← launcher 二进制文件（由操作系统服务运行）
├── binaries/
│   └── oibus               ← 当前使用的 OIBus 二进制文件（Windows 上为 oibus.exe）
├── update/                 ← 升级流程放置的暂存更新文件
│   └── binaries/
│       └── oibus
└── backup/                 ← 升级前自动创建
    ├── oibus
    └── data-folder/        ← 数据文件夹的备份（见下方说明）
```

:::info 部分数据文件夹备份
仅数据文件夹中匹配可配置模式的部分会被备份到 `data-folder/`——
默认情况下为 `cache/` 下的所有内容。这并非数据文件夹的完整快照。该模式可以
通过与暂存更新一同放置的 `update.json` 中的 `backupFolders` 条目来覆盖。
:::

当从 OIAnalytics 收到升级命令时，新的二进制文件会被放置到 `update/binaries/` 中。
launcher 会在下次启动时检测到它。

## 启动流程 {#startup-sequence}

每次 `oibus-launcher` 启动时，都会遵循以下流程：

1. **检查暂存更新** — 检查 `update/` 文件夹中是否有新的二进制文件。

2. **应用更新**（如果存在文件）：
   - 备份 `binaries/` 中的当前二进制文件以及数据文件夹中匹配的部分到 `backup/`。
   - 用 `update/` 中的文件替换 `binaries/` 中的二进制文件。

3. **启动 OIBus** — 将 `oibus` 从 `binaries/` 作为子进程启动，并转发所有 CLI 参数。

4. **监控 30 秒** — 如果 OIBus 在更新后的 30 秒内退出或崩溃，launcher 会
   将其视为升级失败：
   - 停止已崩溃的进程。
   - 从 `backup/` 恢复之前的二进制文件以及已备份的数据文件夹部分。
   - 使用恢复的二进制文件重新启动 OIBus。

5. **标记为稳定** — 如果 OIBus 在 30 秒后仍在运行，则认为更新成功，
   备份会被清理。

:::info 未发现更新
如果 `update/` 文件夹为空，launcher 会跳过步骤 1–2，直接进入步骤 3。
:::

:::tip 崩溃恢复
即使没有更新，同样的监控逻辑也会生效。如果 OIBus 因任何原因崩溃，launcher 会
自动重启它——其行为类似于进程监督器。
:::

## 命令行参数 {#command-line-arguments}

传递给 `oibus-launcher` 的所有参数（`--reset-password` 除外）都会被转发给 `oibus` 子
进程。launcher 还会自动注入 `--launcherVersion <version>`，以便 OIBus 知道是哪个
launcher 版本在管理它。

### `--config` {#--config}

OIBus 数据文件夹的路径。若省略，默认为 `./`。

```bash
oibus-launcher --config /path/to/OIBusData
```

```batch
oibus-launcher --config C:\OIBusData
```

### `--version` {#--version}

打印 `oibus-launcher` 和 `oibus` 的版本号，然后退出。launcher 仍会检查是否存在
暂存更新，但不会应用它——二进制文件/数据文件夹的替换会被跳过。

```bash
oibus-launcher --version
```

### `--reset-password` {#--reset-password}

将管理员用户凭据重置为默认值（`admin` / `pass`）并立即退出。
使用此标志时请始终一并提供 `--config`，以便 launcher 能找到正确的数据库。

```bash
oibus-launcher --reset-password --config /path/to/OIBusData
```

**忘记密码后的恢复步骤：**

1. 停止 OIBus 服务。
2. 运行上述命令。
3. 重启服务。
4. 使用 `admin` / `pass` 登录，并立即在
   [用户设置](../installation/first-access.mdx#user-settings)中修改密码。

:::caution
`--reset-password` 仅由 launcher 处理，永远不会被转发给 `oibus` 二进制文件。
:::
