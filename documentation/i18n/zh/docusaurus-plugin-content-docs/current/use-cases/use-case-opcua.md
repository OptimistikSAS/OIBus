---
displayed_sidebar: useCasesSidebar
sidebar_position: 1
---

# 使用OIAnalytics的OPCUA

## 事前
相关配置的详细信息可以在[North OIAnalytics](../guide/north-connectors/oianalytics.md)和[South OPCUA](../guide/south-connectors/opcua.md)连接器页面上找到。

另外，请确保所选的连接协议为OPCUA，以将其与代表完全不同技术的[OPCDA或OPCHDA](../guide/south-connectors/opc-hda.md)区分开。

## 南方OPCUA
### 您需要了解的信息
OPCUA服务器的完整URL，包括名称，应采用格式`opc.tcp://<host>:<port>/<name>`，其中：
- `host`代表服务器的主机名或IP地址。
- `port`表示服务器用于接受连接的端口。
- `name`表示OPCUA服务器的名称。

指定您的服务器接受的安全模式。如果与`None`不同，请同时指定安全策略。
不建议在除测试目的外使用`None`进行OIBus服务器的身份验证。

提供必要的用户名/密码或证书进行身份验证。

这些细节可以从您的IT团队或负责OPCUA服务器的人那里获得。

### 准备工作

在建立南方连接器之前，请确保OPCUA服务器可以从您安装OIBus的机器上访问（通过IP地址/主机名和端口）。

### 南方连接器
输入所需数据到设置中。保存前，请使用`测试设置`按钮以验证连接。

### 项目
添加您希望读取的节点ID。咨询OPCUA服务器负责人以确定可用数据点。

您可以选择访问`模式`（DA或HA）。在HA模式下，您可以聚合和重新采样数据。确保服务器支持所选的聚合和重新采样选项。如有疑问，请坚持使用`原始数据`聚合。

选择一种[扫描模式](../guide/engine/scan-modes.md)来获取数据。在HA模式下，自上一次获取值以来，会检索项目的值列表；而在DA模式下，只会在请求时间为一个项目检索一个值。

:::tip 大规模导入
对于批量项目导入，请首先点击`导出`按钮以获取具有正确列的CSV文件。文件中的每一行都将对应一个新项目。确保名称是唯一的。
:::

## 北方OIAnalytics
### 您需要了解的信息
### 准备工作
验证OIAnalytics平台是否可以从安装了OIBus的机器访问。为此，请在网络浏览器的地址栏中输入OIAnalytics URL。如果页面正确加载，则可以访问OIAnalytics。如果不行，请确保您的网络防火墙允许连接。

连接问题可能是由于端口规则（HTTPS / 443，虽然非常不可能）或域名规则。咨询您的IT团队以添加允许通信的规则。

在OIAnalytics平台内，导航至配置设置。
在用户管理部分，创建具有以下访问权限的概要文件：
- `值：查询 | 更新`
- `文件上传：更新资源`

然后为具有此类概要文件的用户创建用户，并为其生成访问密钥。
注意安全地存储密钥和秘密：它们将被用来设置北方OIAnalytics连接器。

### 北方连接器
创建OIAnalytics北方连接器并填写相关字段。
保存前，请使用`测试设置`按钮检查连接。
