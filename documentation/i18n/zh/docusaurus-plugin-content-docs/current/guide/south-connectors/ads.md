---
sidebar_position: 9
---

# ADS - TwinCAT
自动化设备规范（ADS）协议作为集成到TwinCAT系统中的传输层，由Beckhoff设计并开发。

控制器中的每个数据项都有一个独特的地址，可以通过OIBus上的ADS连接器方便地访问。

OIBus使用[ads-client](https://github.com/jisotalo/ads-client)库来实现这一目的。

## 特定设置
OIBus使用ADS协议连接到AMS路由器。AMS路由器作为中介，将诸如OIBus之类的ADS客户端连接到PLC和TwinCAT运行时。这种连接性使OIBus能够访问PLC中的数据。

具体的配置可能性取决于AMS路由器的放置和位置。

### 与本地AMS服务器（TwinCAT运行时）
当TwinCAT安装在与OIBus相同的机器和网络上时，ADS连接器能够利用TwinCAT运行时，使用其**Net ID**和**PLC Port**与PLC直接通信（无需指定路由器地址、路由器TCP端口、客户端AMS Net ID、客户端ADS端口）。

Net ID是一个类似IP地址加上两个额外数字值的地址。通常，Net ID对应于网络中用来访问PLC的IP地址，并增加两个附加数字，以区分可通过单个AMS路由器访问的多个PLC。例如，一个示例Net ID可能看起来像是`127.0.0.1.1.1`。

端口指定了AMS路由器中用于与PLC连接的通信终端，默认设置为851。

### 与远程AMS服务器
连接到远程AMS服务器时，您需要**Net ID**和**PLC Port**以及几个附加字段：
- **路由器地址**：这是AMS路由器的IP地址或域名。
- **路由器TCP端口**：AMS路由器用于通信的端口。确保此端口得到网络和操作系统防火墙的允许。
- **AMS Net ID**：这是用于与TwinCAT运行时建立连接的客户端标识符。
- **ADS客户端端口**（可选）：您可以指定客户端用于数据交换的端口。如果留空，AMS服务器将分配一个随机端口。如果您选择指定端口，请确保它不是已被其他客户端使用的端口。

要启用ADS连接器与TwinCAT运行时之间的通信，您必须使用_TwinCAT静态路由_工具配置静态路由。以下示例展示了如何使用**AMS Net ID**配置两条路由，它应在OIBus方使用。关键的是，**AMS Net ID**在与静态路由中指定的IP地址一起使用时才有效。

![TwinCAT Static Routes tool](../../../../../../static/img/guide/south/ads/installation-ads-distant.png)

![Add a TwinCAT Static Route](../../../../../../static/img/guide/south/ads/routes.png)

指定的AMSNetId必须填写在OIBus配置的**AMS Net ID**字段中。

:::danger 多个ADS连接器
OIBus一次只支持一个远程ADS连接器。如果您需要同时连接到两个不同的PLC，则可以通过使用本地AMS服务器来实现。
:::

### 其他特定设置
这里还有一些额外的配置选项：
- **重试间隔**：尝试重连前的等待时间。
- **PLC名称**：您可以指定一个添加到每个项目名称前的前缀，然后它们会被发送到北向缓存中。例如，以PLC名称为`PLC001. `（包括点），一个项目名称为`MyVariable.Value`，一旦检索到值，最终的名称将是`PLC001.MyVariable.Value`。这有助于区分来自不同PLC的数据。另一个PLC的结果项目名称可能类似`PLC002.MyVariable.Value`。
- **枚举值**：您可以选择将枚举序列化为整数还是文本。
- **布尔值**：您可以选择将布尔值序列化为整数还是文本。
- **结构过滤**：有关结构过滤的详细信息，请参阅[特定文档](#结构过滤)。

:::tip 何时使用PLC名称？
在通过两个不同的ADS连接器检索具有共享点地址模式的类似PLC的数据并将其发送到同一个北向连接器的情况下，即使数据来自不同的PLC，最终的值可能具有相同的点ID。

为了消除这种潜在的歧义，您可以选择在数据检索后在每个点ID前附加**PLC名称**。这种做法确保发送到北向连接器的点ID保持不同，当导出这些项目以导入到另一个OIBus中时特别有用。

通过简单地更改PLC名称，您可以确保您的数据在北向目标应用程序中保持唯一。
:::

#### 结构过滤
您还可以使用此方式检索整个数据结构。例如，如果数据_MyVariable_是_MyStructure_类型，并包含诸如_MyDate_、_MyNumber_ 和 _Value_ 等字段，但您只需要_MyDate_和_MyNumber_，您可以在_structure filtering_部分创建一个新的结构，其**结构名称**是`MyStructure`。
在**要保留的字段**部分，您可以指定只需要的字段，用逗号分隔，例如`MyDate, MyNumber`。

当面对多个数据项全部为_MyStructure_类型时，此功能特别有用，但您只对从结构中检索特定字段，诸如_MyDate_和_MyNumber_感兴趣。结构含有的字段越多，此功能的优势越大。

最终，指定的每个字段都会产生一个独特的点ID。在提供的示例中，使用此方法对单个点_MyVariable_会导致两个不同的点：
- MyVariable.MyDate
- MyVariable.MyNumber

## 项目设置
- **地址**：PLC中要查询的数据的地址。