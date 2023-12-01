---
sidebar_position: 3
---

# IP过滤
默认情况下，只允许本地访问。

如果您希望从远程工作站访问OIBus，您可以添加一个远程地址。重要的是要确保正确指定了IP地址格式，无论是IPv4还是IPv6。OIBus支持这两种格式。

当您从脚本中安装OIBus、在Docker容器中或用于其他用例时，允许从远程IP地址访问可能非常有价值。您可以使用默认的凭证和端口执行以下curl命令：
```curl title="curl command"
curl --location --request POST "http://localhost:2223/api/ip-filters" --header "Content-Type: application/json" --data-raw "{\"address\": \"*\", \"description\": \"All\" }" -u "admin:pass"
```