# Azure Blob Storage™

**Azure Blob Storage™ 北向连接器**允许您将文件存储到 **Microsoft Azure Blob Storage™** 或 **Azure Data Lake
Storage** 中。此连接器非常适合云存储、数据湖或与 Azure 服务集成的场景。

**示例用例**：

- **云数据存储**：以经济高效的方式存储大量非结构化数据。
- **备份与归档**：将 OIBus 数据安全归档到 Azure Blob Storage。
- **Azure 生态系统集成**：将存储的数据用于 Azure Functions、Logic Apps 或 Power BI 等 Azure 服务。

## 特定设置 {#specific-settings}

配置以下参数以连接到您的 Azure Blob Storage：

| 设置                        | 描述                                                       | 示例值            |
| --------------------------- | ------------------------------------------------------------ | ------------------ |
| **Azure Data Lake Storage** | 启用以使用 **Azure Data Lake Storage** 而非标准 Azure Blob Storage。 | 启用/禁用         |
| **使用自定义 URL**          | 使用自定义端点 URL 而非基于账户的标准 URL。                   | 启用/禁用         |

### 连接设置 {#connection-settings}

| 设置         | 描述                                                             | 示例值                                            |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------- |
| **账户**     | Azure 存储账户名称。禁用**使用自定义 URL** 时使用。               | `mystorageaccount`                                 |
| **自定义 URL** | 存储服务的完整端点 URL。启用**使用自定义 URL** 时使用。         | `https://mystorageaccount.blob.core.windows.net`   |
| **容器**     | 用于存储文件的 Azure Blob 容器。                                   | `oibus-data`                                       |
| **路径**     | 容器内用于存储文件的文件夹路径。                                   | `factory/line1`                                    |

### 身份验证 {#authentication}

| 设置             | 描述                                                                       | 示例值                                                                       |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **身份验证**     | 身份验证方法。                                                             | `Access key`、`SAS token`、`AAD - Application Active Directory`、`External`   |
| **访问密钥**     | 账户访问密钥。Access key 身份验证方式必填。                               | `••••••••`                                                                    |
| **SAS 令牌**     | 用于限时访问的共享访问签名令牌。SAS token 身份验证方式必填。               | `sv=2021-06-08&...`                                                          |
| **租户 ID**      | Azure Active Directory 租户 ID。AAD 身份验证方式必填。                     | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                       |
| **客户端 ID**    | 应用程序（客户端）ID。AAD 身份验证方式必填。                               | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                       |
| **客户端密钥**   | 应用程序客户端密钥。AAD 身份验证方式必填。                                 | `••••••••`                                                                    |

### 代理配置 {#proxy-configuration}

如果您的网络基础设施要求请求通过代理服务器才能到达 Azure Blob Storage，请启用**使用代理**选项并在下方配置代理详细信息。

| 设置           | 描述                             | 示例值                             |
| -------------- | -------------------------------- | ----------------------------------- |
| **代理 URL**   | 代理服务器的 URL。               | `http://proxy.example.com:8080`     |
| **代理用户名** | 用于代理身份验证的用户名（如需要）。 | `proxy_user`                      |
| **代理密码**   | 用于代理身份验证的密码（如需要）。 | `••••••••`                        |

## 最佳实践 {#best-practices}

- **监控**：使用 Azure Monitor 跟踪存储使用情况、性能和成本。
