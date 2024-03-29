---
sidebar_position: 2
---

# OIBus 至 OIBus 通信
## 上下文
通常，PLC 只能在称为运维技术 (OT) 领域的受限网络内访问，这个领域通常存在于信息技术 (IT) 领域中或与之相邻，后者包含了数据中心和云系统。出于安全原因，OT 机器无法访问互联网。OIBus 可能需要互联网访问权限。有两种可行的方法可以访问这些网络中的数据：
- 在 IT 领域安装 OIBus，并允许 PLC 在 OT 中从 OIBus 机器连接。在这种方法中，你允许每个数据源从位于 IT 领域（外部于 OT）的 OIBus 机器通过防火墙进行连接。
- 在两个网络中都安装 OIBus：第二个选项涉及在 OT 内部和 IT 内部设置一个 OIBus 实例。这使得两个网络之间仅需管理单一的通信连接。

当你只有一台可用于 OIBus 安装的机器时，第一个选项是可以接受的，但它涉及更复杂的网络配置，并承担将你的机器暴露给潜在安全威胁的风险。第二个选项是更可取的选择。采用这种方法，位于 OT 的初始 OIBus 实例，称为 OIBus1，可以访问同一网络内的机器，并通过单一被防火墙允许的连接（从 OIBus1 到 OIBus2）将数据传输到办公网络。

让我们深入了解设置此通信方法的细节。


## 数据流设置
### 在 OIBus1 中设置北向连接器 OIConnect
[OIBus 北向连接器](../north-connectors/oibus.md)在一个 OIBus 实例由于处于工业网络而缺乏直接互联网访问权限时非常有价值，尽管如此，它可以与位于另一个有互联网访问的网络中的另一个 OIBus 建立通信。

例如，主机地址可能采用 http://1.2.3.4:2223 的形式（OIBus2 的 IP 地址和端口）。确保在第二个 OIBus 引擎的设置中授权远程连接，尤其是在[IP筛选器部分](../engine/ip-filters.md)中，至关重要。另外，应使用适当的用户名和密码。在这种情况下，应该使用 OIBus 默认的用户名和密码（admin 和 pass）进行身份验证。

### 在 OIBus2 中设置外部来源
现在在 OIBus2 上，你必须定义一个[外部来源](../engine/external-sources.md)。如果在 OIBus2 中没有设置外部来源，OIBus1 发送到 OIBus2 的数据将被丢弃。

这个外部来源的名称应遵循名称查询参数的语法，例如，`MyOIBus:MyOIConnect`。

定义了外部来源后，OIBus2 的北向连接器可以继续订阅这个特定的外部来源，从而使两个 OIBus 实例之间的数据交换成为可能。

## 日志
### 通过另一个 OIBus 传输 Loki
要将日志从 OIBus1 传输到 OIBus2，在 _Loki 日志_ 部分内的[引擎页面](../engine/engine-settings.md)中，指定 OIBus2 的地址在 **主机** 字段中，以及它相关的端点：http://1.2.3.4:2223/logs。值得注意的是 OIBus2 使用基本认证。保持 token 地址字段为空，并提供用于连接 OIBus2 的用户名和密码凭据。

在 OIBus1 中如果 loki 级别设置为 **info**，则只有 **info** 级别及以上的日志会被转发到 OIBus2。

在 OIBus2 中，如果控制台和文件级别被配置为 **error**，则只有 **error** 级别或更高级别的日志才会在控制台和文件中记录。然而，如果 OIBus2 的 loki 级别也被设置为 **info**，那么从 OIBus1 收到的所有日志都会被发送到这个 loki 端点（在 OIBus2 中设置）。
