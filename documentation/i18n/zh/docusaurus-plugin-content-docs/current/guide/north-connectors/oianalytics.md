---
sidebar_position: 1
---

# OIAnalytics
OIAnalytics SaaS 应用程序配备了处理 JSON 和文件有效载荷的能力。JSON 有效载荷包括从各种如 OPCUA 和 MQTT 的南向点协议获得的格式化数据点。

另一方面，文件正如通过北向连接器收到的那样进行传输，无论它们是否被压缩。OIAnalytics 能够管理多种文件格式，包括 CSV、TXT 和 XLSX。OIAnalytics 提供了内置文件解析器的优势，省去了数据预处理的必要。解析过程在 SaaS 应用程序中轻松展开，得益于其易于配置的设置。

## 设置
以下是配置与 OIAnalytics SaaS 应用程序连接的重要参数：
- **使用 OIAnalytics 模块**： 使用 OIAnalytics 模块的连接设置
- **超时**： 在 HTTP 请求中报告连接失败前的持续时间。
- **压缩数据**： 如果数据尚未压缩，则对其进行压缩。压缩文件将以 .gz 文件扩展名检测，JSON 有效载荷将被压缩并发送到特定的 OIAnalytics 端点。

如果未使用 OIAnalytics 模块，则将使用以下字段：
- **主机**： SaaS 应用程序的主机名（如 `https://optimistik.oianalytics.com`）。
- **接受未授权证书**： 该选项在 HTTP 查询穿越防火墙时非常有用，因为防火墙会删除证书。
- **访问密钥**： OIAnalytics 生成的访问密钥。
- **秘钥**： 与生成的访问密钥相对应的密钥。
- **使用代理**： 利用代理发送 HTTP 请求的选项。
- **代理 URL**： 要通过的代理服务器的 URL。
- **代理用户名**：与代理关联的用户名。
- **代理密码**：与代理关联的密码。

## OIAnalytics 访问
发送到 OIAnalytics 的数据是通过 OIAnalytics 公共 API 传输的。OIAnalytics 中的 API 访问与用户账户相关联。代替常规登录凭据，必须在 OIAnalytics 中使用以下步骤建立 API 密钥：
1. 导航至配置 -> 用户。
2. 找到您打算为其生成 API 密钥的用户，然后点击密钥图标。
3. 创建一个 API 密钥以生成新的 API 密钥。确保复制并安全地存储密钥及其关联的密码。
4. 在 OIBus 中，填入 API 密钥及其关联的秘密密钥。

![OIAnalytics API 密钥生成](@site/static/img/guide/north/oianalytics/oia-api-key-gen.png)

:::danger 密码检索
必须强调的是，API 密钥生成是访问和复制与其关联的密码的唯一机会。如果您丢失了这个密码，您需要生成一个新的 API 密钥才能获得它。
:::

:::tip API 用户
我们建议在 OIAnalytics 中创建一个专用的 API 用户，仅用于 API 访问。建议为每个 OIBus 实例分配唯一的 API 密钥。这种方法提供了更容易的密钥管理优势，使您可以在必要时撤销特定的 API 密钥而不影响其他实例。
:::