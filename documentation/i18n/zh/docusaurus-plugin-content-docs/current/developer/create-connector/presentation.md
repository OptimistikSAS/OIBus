---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# 创建一个新的 OIBus 连接器

OIBus 连接器使用 [TypeScript](https://www.typescriptlang.org/) 编写。**South** 连接器 _从_
数据源（PLC、文件系统、数据库、MQTT broker 等）_获取_数据；**North** 连接器则将数据 _投递_到
目的地（文件、OIAnalytics、OPC UA 服务器、S3 等）。

本指南将带您了解文件布局、思维模型，以及向引擎注册新连接器所需的接入步骤。

:::tip Before you start
如果不确定从何入手，请联系 OIBus 团队——您需要的功能可能已经被某个现有连接器支持，
或者更适合作为对现有连接器的增强来实现。
:::

## 文件布局 {#file-layout}

每个连接器都位于 `backend/src/north/` 或 `backend/src/south/` 下自己的文件夹中：

```
backend/src/south/south-<type>/
├── manifest.ts                  ← form schema: settings + items
├── south-<type>.ts              ← the connector class
└── south-<type>.spec.ts         ← unit tests (target 100% coverage)
```

```
backend/src/north/north-<type>/
├── manifest.ts                  ← form schema: settings only
├── north-<type>.ts              ← the connector class
└── north-<type>.spec.ts         ← unit tests
```

共享协议相关辅助功能（解析、证书处理、套接字工具）的连接器，通常会将这些内容
提取到 `backend/src/service/utils-<type>.ts` 中，以便连接器类专注于生命周期和
编排逻辑。例如：`service/utils-opcua.ts`、`service/utils-mqtt.ts`、`service/utils-modbus.ts`。

## 思维模型 {#mental-model}

|          | **South**                                                      | **North**                                          |
| -------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| 方向     | 从数据源 _拉取_                                                  | 向目的地 _推送_                                     |
| 触发方式 | 定时任务（扫描模式）、订阅推送，或直接查询                       | 由定时任务驱动，从本地文件缓存中 _拉取_             |
| 输出     | 通过 `this.addContent(...)` 将批数据推送给引擎                    | 实现 `handleContent(fileStream, metadata)`         |
| 持久化状态 | 每个条目缓存的 `trackedInstant`，用于可恢复的历史读取             | 逐文件缓存 → 归档 / 错误文件夹                       |

South 的批数据由引擎本身写入每个 North 的文件缓存；每个 North 再按各自的节奏
从该缓存中提取数据。这种解耦意味着一个不稳定的目的地不会阻塞 South 的数据摄取——
文件只会在缓存中堆积，并在下一次触发时重试。

## 注册步骤 {#registration-steps}

添加一个新的连接器类型，除了连接器文件夹本身之外，还需要四处修改。TypeScript
编译器会捕获前三处；第四处是一个运行时检查。

### 1. 将类型 id 添加到共享列表中 {#1-add-the-type-id-to-the-shared-list}

对于 South 连接器，将您的 id 追加到 `backend/shared/model/south-connector.model.ts`
中的 `OIBUS_SOUTH_TYPES`：

```typescript title="backend/shared/model/south-connector.model.ts"
export const OIBUS_SOUTH_TYPES = [
  // ...existing types...
  'my-new-source' // ← your new type id (kebab-case)
] as const;
```

North 连接器则使用 `backend/shared/model/north-connector.model.ts` 中的
`OIBUS_NORTH_TYPES`。

从现有列表（`OIBUS_SOUTH_CATEGORIES` 或 `OIBUS_NORTH_CATEGORIES`）中选择一个
`category`。除非有充分的理由，否则不要添加新的类别——UI 是按类别对连接器进行
分组的，单独为一个连接器新建类别会让这种分组失去意义。

### 2. 在工厂中注册 {#2-register-in-the-factory}

工厂负责根据已存储的配置行构建连接器实例。为您的类型添加一个 `case`：

```typescript title="backend/src/south/south-connector-factory.ts"
case 'my-new-source':
  return new SouthMyNewSource(
    settings as SouthConnectorEntity<SouthMyNewSourceSettings, SouthMyNewSourceItemSettings>,
    addContent,
    southCacheRepository,
    logger,
    southCacheFolder
  );
```

North 对应的是 `backend/src/north/north-connector-factory.ts` 中的 `buildNorth(...)`。

### 3. 将类型 id 映射到生成的设置接口名称 {#3-map-the-type-id-to-the-generated-settings-interface-name}

设置类型（`South<Type>Settings`、`South<Type>ItemSettings`）是根据清单生成的。
在 `backend/src/settings-interface.generator.ts` 中告诉生成器如何为它们命名：

```typescript title="backend/src/settings-interface.generator.ts"
function buildSouthInterfaceName(connectorId: string, itemInterface: boolean): string {
  const prefix = itemInterface ? 'Item' : '';
  switch (connectorId) {
    // ...
    case 'my-new-source':
      return `SouthMyNewSource${prefix}Settings`;
  }
}
```

然后从 `backend/` 目录重新生成：

```bash
npm run generate:settings-interface
```

该脚本会读取每一个 `manifest.ts`，推导出对应的 TypeScript 接口，并写入
`backend/shared/model/south-settings.model.ts`（以及 North 对应的文件）。生成器
还会刷新 OpenAPI 定义。

:::caution
在添加新类型后首次运行时，生成的类型尚不存在——这是正常现象。生成完成后，
您的连接器类就可以针对新生成的类型进行编译了。
:::

### 4. 翻译 key {#4-translation-keys}

清单中的每一个 `translationKey` 都必须能在前端的 i18n 包
（`frontend/src/assets/i18n/*.json`）中解析为一个字符串。约定的格式是
`configuration.oibus.manifest.<south|north>.<connector-type>.<field>`。缺失的
key 会回退显示 key 本身——UI 仍能正常工作，只是看起来不够美观。

## 接下来 {#whats-next}

- **[清单](./manifest.md)** — 设置 schema、属性类型、校验器、条件显示。
- **[连接器类](./class.md)** — 基类、能力接口、生命周期、示例。
