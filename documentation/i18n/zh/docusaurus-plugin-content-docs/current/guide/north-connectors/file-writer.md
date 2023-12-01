---
sidebar_position: 3
---

# 文件写入器
文件写入器连接器执行一个简单的任务，将来自南向连接器接收的数据写入到一个指定的文件夹中。

## 特定设置
- **输出文件夹**：这是将存储文件的目录。如果是相对路径，它是基于 _关于_ 部分提到的**数据文件夹**计算得出的。
- **文件名前缀**：你可以加入一个前缀到文件名。
- **文件名后缀**：你可以选择在文件扩展名之前追加一个后缀到文件名。

:::tip
前缀和后缀选项可以包含内部变量`@ConnectorName` 和 `@CurrentDate`。例如，使用 `@ConnectorName-` 作为前缀并 `-@CurrentDate` 作为后缀时，像 _example.file_ 这样的文件名将导出为 `<ConnectorName>-example-<CurrentDate>.file` 的格式，其中 `<CurrentDate>` 会被替换成当前日期和时间的 **yyyy_MM_dd_HH_mm_ss_SSS** 格式。
:::

## JSON 负载
在JSON负载的情况下，JSON数据将被存储在一个JSON文件中。例如：
```json title="JSON file"
[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]
```
