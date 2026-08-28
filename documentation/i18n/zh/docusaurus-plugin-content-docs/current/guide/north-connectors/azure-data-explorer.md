# Azure Data Explorer™

**Azure Data Explorer™ 北向连接器**通过 Microsoft 官方 SDK，使用**排队摄取（queued ingestion）**将 OIBus 数据摄取到
**Azure Data Explorer（Kusto）**集群、数据库和表中。这是 OIBus 首个属于**数据库**类别的北向连接器。

**示例用例**：

- **大规模时序数据分析**：存储大量工业时序数据，以实现快速、可扩展的分析。
- **临时 KQL 查询**：使用 Kusto 查询语言（KQL）交互式地探索和查询工业数据。
- **仪表盘与报表**：直接从 Azure Data Explorer 为 Power BI 或 Azure 仪表盘提供数据。
- **历史库卸载**：将 Azure Data Explorer 用作 OIBus 数据的长期、低成本历史库。

## 特定设置 {#specific-settings}

配置以下参数以连接到您的 Azure Data Explorer 集群：

| 设置                       | 描述                                                                                                                             | 示例值                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **集群 URL**               | Azure Data Explorer 集群的引擎端点。请输入普通的集群 URL，而非 `ingest-` 端点：连接器会自动从中派生出摄取（`ingest-`）端点。       | `https://mycluster.westeurope.kusto.windows.net`   |
| **数据库**                 | 要摄取到的 Azure Data Explorer 数据库名称。                                                                                       | `oibus`                                            |
| **表**                     | 要摄取到的目标表名称。该表必须已存在于 Azure Data Explorer 中。                                                                   | `TimeValues`                                       |
| **数据格式**               | 用于向 Azure Data Explorer 发送数据的格式。必须与该连接器上选择的转换器匹配。                                                     | `CSV`、`JSON`、`Multiline JSON`                    |
| **摄取映射名称**           | 预先创建的 Azure Data Explorer 摄取映射名称，用于映射列。可选；必须已存在于 Azure Data Explorer 中。为空时，Azure Data Explorer 使用其默认的列解析方式。 | `TimeValuesMapping`                                |

### 身份验证 {#authentication}

Azure Data Explorer 支持三种身份验证模式：

| 设置             | 描述                                                                                                       | 示例值                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **身份验证**     | 身份验证方法。                                                                                                 | `AAD application secret`、`AAD application certificate`、`Managed identity`     |
| **租户 ID**      | Azure Active Directory 租户 ID。`AAD application secret` 和 `AAD application certificate` 方式必填。          | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                          |
| **客户端 ID**    | 应用程序（客户端）ID。`AAD application secret` 和 `AAD application certificate` 方式必填。                    | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                          |
| **客户端密钥**   | 应用程序客户端密钥。`AAD application secret` 方式必填。                                                        | `••••••••`                                                                      |
| **证书**         | 用于身份验证的证书，从 OIBus 的证书库中选择。`AAD application certificate` 方式必填。                          | `my-adx-certificate`                                                            |

使用 `Managed identity` 时无需提供凭据：OIBus 会使用其所运行主机的环境 Azure 托管身份进行身份验证（例如带有系统分配或用户分配托管身份的
Azure 虚拟机或应用服务）。

### 代理 {#proxy}

如果您的网络基础设施要求请求通过代理服务器才能到达 Azure Data Explorer，请启用**使用代理**选项并在下方配置代理详细信息。

| 设置           | 描述                             | 示例值                             |
| -------------- | -------------------------------- | ----------------------------------- |
| **代理 URL**   | 代理服务器的 URL。               | `http://proxy.example.com:8080`     |
| **代理用户名** | 用于代理身份验证的用户名（如需要）。 | `proxy_user`                      |
| **代理密码**   | 用于代理身份验证的密码（如需要）。 | `••••••••`                        |

代理支持是部分性的。Azure Data Explorer SDK 未暴露任何代理选项，因此 OIBus 会将代理直接安装到 SDK 的 HTTP
客户端上，并同时将其传递给用于身份验证的 Entra ID（`@azure/identity`）凭据。这涵盖了 Azure Data Explorer 调用本身——
管理命令（包括**测试设置**）和摄取资源发现——以及向 Entra ID 发起的用于获取和刷新凭据的令牌请求。

它**不**涵盖有效负载上传：排队摄取通过 Azure Storage SDK 上传文件，而该 SDK 不遵循此设置。如果这些上传也必须经过代理，
请在操作系统级别额外设置 `HTTPS_PROXY`，作为对此处代理配置的补充。

## 重要说明 {#important-notes}

- **数据格式必须与转换器匹配**：使用 `oibus-time-values-to-csv` 转换器配合 `CSV` 数据格式，或使用
  `oibus-time-values-to-json` 转换器配合 `JSON` 或 `Multiline JSON` 数据格式。转换器与数据格式不匹配会导致
  Azure Data Explorer 一侧的摄取失败。
- **摄取是排队处理的，而非流式的**：Azure Data Explorer 接受批次数据并异步完成摄取，因此数据行只有在
  Azure Data Explorer 自身的批处理延迟（默认最多约 5 分钟，由目标表的摄取批处理策略控制）之后才可查询。
  OIBus 中发送成功仅表示数据已被接受用于摄取，并不意味着数据立即可查询。
- **模式必须预先存在**：目标表及任何摄取映射必须提前在 Azure Data Explorer 中创建。此连接器不会创建或更改模式。

## 测试连接 {#testing-the-connection}

**测试设置**操作会针对配置的集群、数据库和表运行一条轻量级的 `.show table … cslschema` 管理命令。这可验证集群的可达性、
身份验证以及目标表是否存在，而不会摄取任何数据。
