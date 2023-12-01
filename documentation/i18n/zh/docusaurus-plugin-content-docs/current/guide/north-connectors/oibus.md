---
sidebar_position: 2
---

# OIBus
OIBus 是一种北向连接器，专为发送数据到其他 OIBus 端点而设计。它支持发送到 `/api/add-values` 的 [JSON 负载](#json-payload)，和发送到 `/api/add-file` 的文件。

## 特定设置
要将数据（无论是 JSON 还是文件格式）传输到另一个 OIBus 实例，您需要完成以下字段：
- **主机**：目标 OIBus 的主机名（例如，`http://1.2.3.4:2223`）。
- **用户名**：用于连接的用户名。
- **密码**：与指定用户名相关联的密码。
- **使用代理**：用于 HTTP 请求的代理选项。
- **代理 URL**：要使用的代理服务器的 URL。
- **代理用户名**：与代理相关的用户名。
- **代理密码**：与代理用户名相关联的密码。

## JSON 负载
另一个 OIBus 将接受以下负载格式：
```json 标题="JSON 负载"
[
  {
    "timestamp": "2020-01-01T00:00:00.000Z",
    "data": "{ value: 28 }",
    "pointId": "MyPointId1"
  }
]
```

## 连接两个 OIBus
有关如何在一个 OIBus 实例与另一个之间建立连接的详细说明，请参阅[所提供的文档](../advanced/oibus-to-oibus.md)。

## HTTPS
OIBus 仅包含一个 HTTP 服务器。要在两个 OIBus 实例之间建立 HTTPS 连接，建议使用像 Nginx 或 Apache 这样的专用 HTTP 服务器作为 OIBus 前的反向代理。通过这样做，您可以将证书管理委托给 HTTP 服务器，并安全地将 HTTPS 请求转发到相关端口上的 OIBus HTTP 服务器。