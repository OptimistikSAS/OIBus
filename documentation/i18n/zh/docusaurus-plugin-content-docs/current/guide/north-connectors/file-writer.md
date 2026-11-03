# 文件写入

**文件写入北向连接器**将文件写入磁盘上指定的输出文件夹。此连接器适用于本地存储、数据处理管道或与基于文件的系统集成。

它只接收文件：记录列表（包括 OIAnalytics 设定值）由转换器（例如[文件](../engine/transformers.mdx#file-from-records)）
写入文件。在 3.10 之前，它也接收记录和设定值：升级时，会通过
[文件（原样、重命名或转换）](../engine/transformers.mdx#file-as-is-renamed-or-converted)将
[记录](../engine/transformers.mdx#records-from-file)转换器的行写入 JSON 文件，并删除其发送记录或设定值的自定义转换器。

## 特定设置 {#specific-settings}

| 设置           | 描述                                                                 | 示例值            |
| -------------- | -------------------------------------------------------------------- | ----------------- |
| **输出文件夹** | 存储文件的目录。相对路径基于**数据文件夹**解析（参见 _关于_ 部分）。 | `/data/oibus-out` |

### 网络共享身份验证（仅限 Windows） {#network-share-authentication-windows-only}

要写入 Windows 网络共享，请将**输出文件夹**设置为 UNC 路径（`\\server\share\...`）并提供凭据：

| 设置           | 描述                                                    | 示例值      |
| -------------- | ------------------------------------------------------- | ----------- |
| **SMB 用户名** | 用于对网络共享进行身份验证的用户名。                    | `svc_oibus` |
| **SMB 密码**   | SMB 用户名对应的密码。                                  | `••••••••`  |
| **SMB 域**     | SMB 用户名所在的域（可选，例如用于 Active Directory）。 | `CORP`      |

:::info 仅限 Windows
这些字段仅在 OIBus 运行于 Windows 时出现。OIBus 在写入前会对服务器进行 SMB 会话身份验证（`net use`），并在连接器
断开连接时将其移除。此过程不经过 Windows 凭据管理器，因此即使 OIBus 以 Windows 服务方式运行时也能正常工作——在这种
情况下，仅限交互式会话的凭据管理器即使在原本有权访问该共享的账户下也不可靠。
:::

### 文件名 {#file-names}

文件以其转换器给出的名称写入，不含其子文件夹：即
[文件（原样、重命名或转换）](../engine/transformers.mdx#file-as-is-renamed-or-converted)和
[文件](../engine/transformers.mdx#file-from-records)转换器的**文件名**（例如 `@SourceFilename-@CurrentDate@SourceExtension`）。

:::info 升级到 3.10
在 3.10 之前，连接器会在文件名中添加**前缀**和**后缀**。升级时会将它们添加到其转换器的文件名中，其中 `@ConnectorName`
会被替换为该连接器的名称（在转换器中，`@ConnectorName` 是南向连接器的名称），并重命名其缓存中等待发送的文件。自定义
转换器自行为文件命名。
:::

## 最佳实践 {#best-practices}

- 为输出文件夹使用**绝对路径**，以避免歧义。
- 为每个连接器创建**专用目录**，以保持文件的条理性。
- 结合[转换器](./common-settings#transformers)以：
  - 将数据转换为其他格式（例如 JSON、CSV）。
  - 在写入前过滤或丰富数据。
- 监控磁盘空间使用情况，尤其是在处理大量数据时。
