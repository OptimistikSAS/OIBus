---
sidebar_position: 5
---

# 外部来源和端点
## 外部来源
外部来源指的是通过HTTP请求将数据传输到OIBus端点的远程实体。这一功能
使其他应用程序可以在不配置南部连接器的情况下向OIBus发送数据。

北部连接器有能力订阅南部连接器或外部来源以检索数据
这些来源的数据。然而，如果OIBus内没有定义外部来源，任何来自该来源的传入数据都将被
忽略以防止缓存饱和。

要注册一个外部来源，简单地提供其名称，该名称将作为查询参数`name`使用，如下所示。
虽然可选，但增加描述可以有助于提供关于这个外部来源目的的上下文。

## OIBus数据端点
OIBus能够通过两个不同的端点接收数据：
- POST `/api/add-values`：此端点用于接受有效载荷中的JSON格式的值。它利用基本认证来保障安全。
- POST `/api/add-file`：在这里，数据以HTTP表单数据的形式接收文件。这个端点也要求基本认证。

这两个端点都需要包含查询参数`name`，它指定了与数据相关联的外部来源。
OIBus引擎处理这些数据并将其储存在订阅了指定外部来源的北部缓存中。

## 数据来自另一个OIBus和OIConnect
如果您打算使用
[OIConnect北部连接器](../../guide/north-connectors/oibus.md)将数据从一个OIBus实例传输到另一个实例，结果的`name`查询参数是`MyFirstOIBus:MyOIConnect`。
因此，您的外部来源配置也必须定义为`MyFirstOIBus:MyOIConnect`来建立
两个OIBus实例之间的连接。

## 数据来自另一个应用程序
### JSON载荷
要使用JSON载荷将数据传输到OIBus，您可以使用以下载荷进行HTTP请求：
```json title=Payload example
[
    {
        "timestamp": "2023-01-01T00:00:00.000Z",
        "pointId": "my reference",
        "data": {
            "value": 1234
        }
    },
    {
        "timestamp": "2023-01-01T10:00:00.000Z",
        "pointId": "another reference",
        "data": {
            "value": 456
        }
    }
]
```

```curl title="curl command"
curl --location 'http://localhost:2223/api/add-values?name=%27test%27' \
--header 'Content-Type: application/json' \
-u <username>:<password> \
--data '[
    {
        "timestamp": "2023-01-01T00:00:00.000Z",
        "pointId": "my reference",
        "data": {
            "value": 1234
        }
    },
    {
        "timestamp": "2023-01-01T10:00:00.000Z",
        "pointId": "another reference",
        "data": {
            "value": 456
        }
    }
]'
```

此请求将导致成功响应，并带有 `204 无内容` 状态。

### 文件负载
要向OIBus发送文件，您可以使用以下curl命令：

```curl title="curl command"
curl --location 'http://localhost:2223/api/add-file?name=%27test%27' \
-u <username>:<password> \
--form 'file=@"<file-path>"'
```

此请求将导致成功响应，并带有 `204 无内容` 状态。
