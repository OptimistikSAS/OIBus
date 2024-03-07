---
sidebar_position: 10
---

# OPCHDA
OPCDA和OPCHDA是由[OPC基金会](https://opcfoundation.org/)开发的工业界使用的通信协议。这项技术已被OPCUA取代，但在工业界仍广泛使用。要在OIBus中使用OPCUA，请参阅[OPCUA连接器文档](./opcua.md)。

HDA服务器允许检索数据的历史记录，涵盖较长或较短的时间段，而DA服务器只允许检索标签的最新值。

OIBus仅支持OPCHDA。该连接器使用[OIBus Agent](../oibus-agent/installation.mdx)和一个专用的HDA模块。

:::caution
使用HDA模块时，OIBus Agent必须安装在Windows机器上。
:::

HDA模块也可以作为独立使用，以命令行方式执行OPC历史数据提取。参阅[OPCHDA代理文档](../oibus-agent/opchda.mdx#hda-module)以独立使用该模块，并查看COM/DCOM设置文档，以正确安装该模块。

## 特定设置
OIBus通过TCP服务器/客户端通信与HDA代理交换命令和数据。因此，需要填写几个字段，使OIBus能够与HDA代理通信：
- **远程代理URL**：指定远程OIBus代理的URL，例如，http://ip-address-or-host:2224。
- **连接超时**：设置建立连接的超时时间。
- **重试间隔**：重新尝试连接前的等待时间。
- **服务器主机**：OPC服务器的地址（来自远程OIBus代理机器）。
- **服务器名称**：OPC服务器的名称（例如Matrikon.OPC.Simulation）。

## 项目设置
在配置每个项目以检索JSON有效负载中的数据时，您需要指定以下特定设置：
- **节点ID**：节点ID对应于OPC服务器上适当命名空间中数据的路径。
- **汇总**：在请求的间隔内汇总检索到的值（确保服务器支持该汇总）。
- **重采样**：当汇总不同于`Raw`时，可以在请求的间隔内重新采样检索到的值。

:::caution 与OPC服务器的兼容性
重要的是要注意，并非所有的聚合和重采样选项都由OPC服务器支持。为避免兼容性问题，建议尽可能使用`Raw`聚合和`None`重采样。
:::

项目的名称将作为JSON有效负载中的参考，特别是在北向应用的`pointID`字段中。
