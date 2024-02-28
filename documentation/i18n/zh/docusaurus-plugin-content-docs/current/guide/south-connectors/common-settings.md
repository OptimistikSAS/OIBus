---
sidebar_position: 0
---

# 概念
南向连接器负责从特定数据源获取数据并将该数据转发到北向缓存。
每个连接器可以请求多个项目，每个项目的性质根据连接器类型的不同而有所不同。例如，
一个[MQTT项目](./mqtt.md)订阅来自远程代理的主题，而一个[MSSQL项目](./mssql.mdx)定期查询
Microsoft SQL数据库。

要添加南向连接器，请导航到南向页面并点击'+'按钮。选择一个可用的南向连接器类型并完成其设置。表单结构可能基于所选连接器类型而有所不同，但某些原则保持一致。

您可以从其显示页面监控南向连接器的状态或对其设置进行调整。

## 通用设置
- **名称**：连接器的名称作为用户友好的标签，帮助您轻松识别其用途。
- **描述**：您可以选择包含描述以提供额外的上下文，例如关于连接、访问权限或任何独特特征的详细信息。
- **切换**：您可以使用开关启用或禁用连接器。此外，您可以从南向连接器列表或其专用显示页面（通过列表页面的放大镜图标访问）切换连接器。

## 历史设置
对于能够检索历史数据的南向连接器（例如，SQL，OPCUA），您可以灵活地以间隔请求数据。
这些间隔的大小可以变化，取决于因素如所选扫描模式或网络故障的持续时间。为处理此类场景，历史设置使您能够将大间隔分为
较小的子间隔，每个子间隔不超过指定的**最大读取间隔**（以秒为单位）。这些子间隔将根据**读取延迟**设置定义的延迟请求。

在某些情况下，给历史查询添加重叠可能是有益的。您可以通过配置
**重叠**字段（以毫秒为单位）来实现此目的：它将从随后查询的`@StartTime`
变量中减去指定数量的毫秒。

## 特定部分
更详细的信息可以在相应连接器的文档中找到特定设置。

### 测试连接
**测试设置**按钮提供了一种方便的方式来验证和测试您的连接设置。

## 项目部分
项目是负责从目标数据源检索数据的实体，可以作为文件
或JSON有效载荷获取。一个南向连接器可以处理几个项目。编辑项目时，您需要提供以下信息：
- **名称**：项目的名称作为北向目标应用程序的参考。它必须在给定南向连接器内唯一。
- **扫描模式**：[扫描模式](../engine/scan-modes.md)指示OIBus何时请求数据。一些连接器（如
MQTT或OPCUA）可能有一个`订阅`扫描模式，其中代理（MQTT）或服务器（OPCUA）将数据发送给OIBus。
- **特定设置** 对于项目可能基于连接器类型而有所不同。

此外，每个项目都可以从项目的编辑表单或从连接器的显示页面禁用。当一个
项目被禁用时，它将不会被连接器请求。

### 项目导出
您可以将项目导出到一个CSV文件，包含以下列：
- **name**：项目的名称。
- **enabled**：如果项目已启用，则为1；如果已禁用，则为0。
- **scanMode**：扫描模式的名称。
- **settings_***：项目的所有特定设置。

导出的文件将以连接器的名称命名：`connector.csv`。

### 项目导入
您可以从CSV文件中导入项目。为此，建议首先导出项目列表，以便您有一个正确格式化的文件，用作导入的模板。

:::info
当您上传CSV文件时，系统将进行重复检查并验证设置。在验证过程之后，所有格式正确的项目将被添加。
:::

### 更改扫描模式和最大瞬时问题
具有历史数据能力的South连接器在`cache.db`数据库的`cache_history`表中维护最后最大瞬时的记录。本节提供了有关最大瞬时如何与扫描模式和项目关联操作的深入解释。

对于数据库South连接器，`每个项目的最大瞬时`选项始终处于启用状态，并且无法更改。在像OPCUA（在HA模式下）这样的South连接器中，用户可以选择为每个项目维护一个最大瞬时，即使它们共享相同的扫描模式，或者将具有相同扫描模式的项目分组在一起，从而产生单一的最大瞬时。

#### 每个项目的最大瞬时是`启用的`
##### 更改项目的扫描模式
更改项目的扫描模式会导致之前的缓存条目被删除，并创建一个新的缓存条目，使用之前的`max_instant`。

- 示例：将item1的扫描模式从`scan_prev`更改为`scan_new`。

    **`cache_history`表（在`cache.db`数据库中）更改前**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | item1   | 2024-02-16T00:00:00.000Z |

    **`cache_history`表（在`cache.db`数据库中）更改后**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | item1   | 2024-02-16T00:00:00.000Z |

##### 删除一个项目
它会从`config.db`数据库的`south_items`表中删除该项目，并从`cache.db`数据库的`cache_history`表中删除相应的条目。


##### 移除south
它会从`config.db`数据库的`south_items`表中删除所有关联的项目及其在`cache.db`数据库的`cache_history`表中的关联条目。

#### 每个项目的最大瞬时是`禁用的`
##### 更改项目的扫描模式
- 示例：新的扫描模式在`cache_history`表（在`cache.db`数据库中）不存在
  它会删除之前的缓存条目，但**仅当没有其他项目使用之前的扫描模式时**。随后，它会创建一个新的缓存条目，使用之前的**max_instant**。

    **`south_items`表（在`config.db`数据库中）更改前**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |

    **`cache_history`表（在`cache.db`数据库中）更改前**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    **`south_items`表（在`config.db`数据库中）更改后**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_new     | item1   |
    | south1   | scan_prev    | item2   |

    **`cache_history`表（在`cache.db`数据库中）更改后**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-02-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    在这种情况下，会生成一个新的缓存条目（`south1 → scan_new`），但旧的条目（`south1 → scan_prev`）会被保留，因为`item2`仍然使用之前的扫描模式。

    :::info
    如果`item1`是唯一使用`scan_prev`的项目，则`south1 → scan_prev`条目将被删除。因此，如果`item1`的扫描模式被恢复为`scan_prev`，它将采用`scan_new`的`max_instant`。然而，如果`south1 → scan_prev`组合仍然存在，请参考下一个案例。
    :::

- 示例：新的扫描模式在`cache_history`表（在`cache.db`数据库中）存在
  它会删除之前的缓存条目，但**仅当没有其他项目使用之前的扫描模式时**，并且**不会**创建新的缓存条目也不会更新现有的`max_instant`。
**`south_items`表（在`config.db`数据库中）变更前**
| south_id | scan_mode_id | item_id |
|----------|--------------|---------|
| south1   | scan_prev    | item1   |
| south1   | scan_prev    | item2   |
| south1   | scan_new     | item3   |

**`cache_history`表（在`cache.db`数据库中）变更前**
| south_id | scan_mode_id | item_id | max_instant              |
|----------|--------------|---------|--------------------------|
| south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
| south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

**`south_items`表（在`config.db`数据库中）变更后**
| south_id | scan_mode_id | item_id |
|----------|--------------|---------|
| south1   | **scan_new** | item1   |
| south1   | scan_prev    | item2   |
| south1   | scan_new     | item3   |

**`cache_history`表（在`cache.db`数据库中）变更后**
| south_id | scan_mode_id | item_id | max_instant              |
|----------|--------------|---------|--------------------------|
| south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
| south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

在这种情况下，不会创建新的缓存条目（`south1 → scan_new`），因为它已经存在于表中。
此外，`scan_prev`没有被移除，因为`item2`仍然使用它。

:::info
如果`item1`是唯一使用`scan_prev`的项目，则`south1 → scan_prev`条目将被移除。
:::

然而，会出现两个问题：
- `item1`现在使用的`max_instant`比它之前的`max_instant`早一个月。
这导致两个`max_instant`之间的重复查询。随着`item1`从`scan_prev`（2024-02-16）
转换到`scan_new`（2024-01-16），它将对前一个月的数据进行回溯处理。
- 相反，相同的情况可能以相反的方式发生，导致一个月的数据没有被检索。

##### 移除一个项目
只有当没有其他项目使用相同扫描模式时，才会在`cache.db`数据库中删除缓存条目。

##### 移除south
它从`config.db`数据库的`south_items`表中移除所有关联项目，并从`cache.db`数据库的`cache_history`表中移除它们的相关条目。

#### 每个项目的Max instant `disabled`→`enabled`
它会删除与south相关联的所有item_id为`all`的缓存条目，并为每个项目创建新的缓存条目。这些新条目的`max_instant`将是根据扫描模式从先前移除的条目中获得的`max_instant`。

- 示例
    **`south_items`表（在`config.db`数据库中）变更前**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history`表（在`cache.db`数据库中）变更前**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-16T00:00:00.000Z |

    **`south_items`表（在`config.db`数据库中）变更后**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_new     | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history`表（在`cache.db`数据库中）变更后**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | item1   | 2024-02-16T00:00:00.000Z |
    | south1   | scan_prev    | item2   | 2024-02-16T00:00:00.000Z |
    | south1   | scan_new     | item3   | 2024-01-16T00:00:00.000Z |


#### 每个项目的最大瞬时值 `启用`→`禁用`
它移除了与南部关联的所有缓存条目，并为项目使用的扫描模式建立了新的缓存条目。每种扫描模式只添加一个条目。每个新的缓存条目将拥有该条目的扫描模式中先前项目列表的**最新**`max_instant`。

- 示例
    **`south_items`表（在`config.db`数据库中）变更前**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_prev    | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |
    
    **`cache_history`表（在`cache.db`数据库中）变更前**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_prev    | item1   | 2024-02-16T00:00:00.000Z |
    | south1   | scan_prev    | item2   | 2024-02-20T00:00:00.000Z |
    | south1   | scan_new     | item3   | 2024-01-16T00:00:00.000Z |

    **`south_items`表（在`config.db`数据库中）变更后**
    | south_id | scan_mode_id | item_id |
    |----------|--------------|---------|
    | south1   | scan_new     | item1   |
    | south1   | scan_prev    | item2   |
    | south1   | scan_new     | item3   |

    **`cache_history`表（在`cache.db`数据库中）变更后**
    | south_id | scan_mode_id | item_id | max_instant              |
    |----------|--------------|---------|--------------------------|
    | south1   | scan_new     | all     | 2024-01-16T00:00:00.000Z |
    | south1   | scan_prev    | all     | 2024-02-20T00:00:00.000Z |

    在这种情况下，`scan_prev`的`max_instant`被设置为2024-02-20而不是2024-02-16，因为它是一个更新的日期。
    它可能会导致数据丢失。
