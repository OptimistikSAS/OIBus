---
displayed_sidebar: developerSidebar
sidebar_position: 3
---

# 连接器类

连接器类继承自 `NorthConnector<TSettings>` 或 `SouthConnector<TSettings, TItemSettings>`，
并重写少量方法。基类负责处理定时任务（cron）、队列、重试、本地缓存以及
`stop()` / 断开连接流程——您的子类只需专注于协议相关的逻辑。

这两个基类都有详尽的 JSDoc，覆盖了每一个生命周期方法及其相互之间的约定。
本页是快速参考；要了解更深入的细节，请阅读
`backend/src/south/south-connector.ts` 和 `backend/src/north/north-connector.ts`。

## North 连接器 {#north-connectors}

### 最简完整示例 {#minimal-complete-example}

```typescript title="backend/src/north/north-console/north-console.ts"
import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult, OIBusSetpoint, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CacheService from '../../service/cache/cache.service';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';

export default class NorthConsole extends NorthConnector<NorthConsoleSettings> {
  constructor(configuration: NorthConnectorEntity<NorthConsoleSettings>, logger: pino.Logger, cacheService: CacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any', 'time-values', 'setpoint'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    if (!process.stdout.writable) {
      throw new Error('process.stdout is not writable');
    }
    return { items: [] };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'time-values': {
        const values = JSON.parse(await streamToString(fileStream)) as Array<OIBusTimeValue>;
        console.table(values, ['pointId', 'timestamp', 'data']);
        return;
      }
      case 'setpoint': {
        const setpoints = JSON.parse(await streamToString(fileStream)) as Array<OIBusSetpoint>;
        console.table(setpoints, ['reference', 'value']);
        return;
      }
      case 'any':
        console.log(`Sending file ${cacheMetadata.contentFile} (${cacheMetadata.contentSize} bytes)`);
        return;
    }
  }
}
```

### 必须实现的方法 {#required-methods}

| 方法                                                    | 用途                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `supportedTypes(): Array<string>`                      | 该 North 能够投递的 `contentType` 值。**必须与清单（manifest）的 `types` 数组保持一致。** 不受支持的类型会被路由到错误文件夹。 |
| `testConnection(): Promise<OIBusConnectionTestResult>` | 使用当前设置探测目的地。失败时抛出异常——该消息会展示给用户。成功时返回一个包含诊断信息的 `{ items: [...] }`。 |
| `handleContent(fileStream, metadata): Promise<void>`   | 实际投递一份缓存的负载。可以抛出异常——基类会处理重试和错误文件夹。                                        |

### 可选重写方法 {#optional-overrides}

| 方法           | 何时重写                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| `connect()`    | 打开一个长期存在的会话 / 套接字 / HTTP 客户端。当传输就绪后调用 `super.connect()`。 |
| `disconnect()` | 关闭您的传输层。在末尾调用 `super.disconnect()`。必须是幂等的（可被多次调用）。       |

### 重试语义 {#retry-semantics}

当 `handleContent` 抛出异常时，文件会保留在缓存中，`errorCount` 会递增。基类会在
下一次定时任务触发时重试。达到 `caching.error.retryCount` 次失败后，文件会被移动到错误文件夹，以便
队列的其余部分能够继续流转。

对于瞬时错误（网络抖动、服务器预热中），您可以通过在抛出的错误上设置 `forceRetry`
来实现无限重试：

```typescript
import { OIBusError } from '../../shared/model/engine.model';

throw { ...new Error('Connection reset'), forceRetry: true } as OIBusError;
```

`forceRetry` 会让文件无限期地保留在缓存中——永远不会被移动到错误文件夹。

## South 连接器 {#south-connectors}

### 最简骨架 {#minimal-skeleton}

```typescript title="South skeleton — pick one or more capability interfaces"
import SouthConnector from '../south-connector';
import { SouthDirectQuery, SouthHistoryQuery, SouthSubscription } from '../south-interface';
import pino from 'pino';
import { DateTime } from 'luxon';
import { SouthMyTypeSettings, SouthMyTypeItemSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { Instant } from '../../model/types';

export default class SouthMyType extends SouthConnector<SouthMyTypeSettings, SouthMyTypeItemSettings> implements SouthDirectQuery {
  /* and/or SouthHistoryQuery, SouthSubscription */
  constructor(
    connector: SouthConnectorEntity<SouthMyTypeSettings, SouthMyTypeItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    // open your transport here
    await super.connect();
  }

  override async disconnect(): Promise<void> {
    // close your transport here
    await super.disconnect();
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    // throw on failure; otherwise return any diagnostics
    return { items: [{ key: 'Status', value: 'OK' }] };
  }

  async testItem(
    item: SouthConnectorItemEntity<SouthMyTypeItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    // run a single item once and return the produced content
    return { type: 'time-values', content: [] };
  }

  // ─── If you implement SouthDirectQuery ────────────────────────────────────
  async directQuery(items: Array<SouthConnectorItemEntity<SouthMyTypeItemSettings>>): Promise<OIBusTimeValue | null> {
    const startTime = DateTime.now().toUTC().toISO()!;
    const values: Array<OIBusTimeValue> = [];
    // read each item, push to values…

    await this.addContent({ type: 'time-values', content: values }, startTime, items);
    return values.length ? values[values.length - 1] : null;
  }
}
```

### 必须实现的方法 {#required-methods-1}

| 方法                                                       | 用途                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `testConnection(): Promise<OIBusConnectionTestResult>`     | 探测数据源。失败时抛出异常。                              |
| `testItem(item, testingSettings): Promise<OIBusContent>`   | 为 UI 的“测试”按钮运行一次单个条目。返回生成的内容。      |

### 可选重写方法 {#optional-overrides-1}

与 North 相同：`connect()` 和 `disconnect()`。**务必在重写方法的末尾调用 `super.*`**，
以便定时任务状态、订阅记录以及 `'connected'` 事件保持同步。

### 能力接口（仅限 South） {#capability-interfaces-south-only}

South 连接器需要实现来自 `south-interface.ts` 的三个能力接口中的一个或多个。基
类通过运行时的结构化 `in` 检查来检测它们——您无需声明任何标志位。

#### `SouthDirectQuery` {#southdirectquery}

用于一次性读取——例如 Modbus 寄存器读取、REST API 调用、“获取当前值”。

```typescript
interface SouthDirectQuery {
  directQuery(items: Array<SouthConnectorItemEntity<...>>): Promise<unknown | null>;
}
```

基类会在每次扫描模式触发时调用 `directQuery()`。在返回之前，通过
`this.addContent(...)` 将实际读数推送给引擎，并返回最后一个值以便 UI 显示。

示例：`backend/src/south/south-modbus/south-modbus.ts`。

#### `SouthHistoryQuery` {#southhistoryquery}

用于时间窗口读取——例如 OPC UA HistoryRead、SQL `BETWEEN`、OSIsoft PI 归档。

```typescript
interface SouthHistoryQuery {
  historyQuery(
    items: Array<SouthConnectorItemEntity<...>>,
    startTime: Instant,
    endTime: Instant,
    startTimeFromCache: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }>;
}
```

基类负责规划窗口：

- `startTime` / `endTime` — 该次触发的自然范围。
- `startTimeFromCache` — 考虑了已获取数据之后的起始时间。使用它来构建实际的
  查询窗口，这样重启后就不会重新查询历史数据。`startTime` 会被单独保留，这样
  某个区间内发生的错误就不会丢失原始范围起点的记录。

将检索到的最新值的时间戳作为 `trackedInstant` 返回；基类会持久化该值，以便
下次调用从此处继续。如果未检索到任何内容，返回 `{ trackedInstant: null, value: null }`。

示例：`backend/src/south/south-opcua/south-opcua.ts`。

#### `SouthSubscription` {#southsubscription}

用于推送驱动的数据源——MQTT、OPC UA 订阅，以及任何基于事件的场景。

```typescript
interface SouthSubscription {
  subscribe(items: Array<SouthConnectorItemEntity<...>>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemEntity<...>>): Promise<void>;
}
```

每当已配置的条目集合与当前已订阅的集合出现差异时，基类就会调用 `subscribe()`
和 `unsubscribe()`。数据到达时，直接在您的事件处理函数中通过
`this.addContent(...)` 推送。

订阅条目通过其保留的扫描模式 id `'subscription'` 来标识。清单必须允许条目的
`scanMode` 使用 `'SUBSCRIPTION'` 或 `'SUBSCRIPTION_AND_POLL'`，以便 UI 让操作
人员可以选择它。

示例：`backend/src/south/south-mqtt/south-mqtt.ts`（仅订阅），
`backend/src/south/south-opcua/south-opcua.ts`（三种全部支持）。

单个连接器类可以实现这三个接口的任意组合；基类会在每次扫描触发时相应地
进行分发。

### 推送数据 —— `addContent` {#pushing-data--addcontent}

```typescript
await this.addContent(
  content, // OIBusContent (discriminated union by `type`)
  queryTime, // Instant — when this batch was fetched
  items // the items that produced it; used for metadata + transformer routing
);
```

`OIBusContent` 是一个可判别联合类型：

| `type`          | `content` 形状                                                              | 用途                                     |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| `'time-values'` | `Array<OIBusTimeValue>` — `{ pointId, timestamp, data: { value, quality? } }` | 大多数数值型 / 文本型时间序列数据          |
| `'any-content'` | `string` — 一段不透明的序列化负载（例如 JSON 字符串化的 MQTT 消息）           | 当目的地需要原始负载时                     |
| `'any'`         | `{ filePath: string }` — 一个已写入磁盘的文件                                 | 基于文件的连接器（文件夹扫描器、FTP）      |

引擎负责通过其转换器管道，将内容写入每个启用的 North 的缓存中。
请勿直接写入缓存——始终通过 `addContent` 完成。

## 生命周期 {#lifecycle}

```
start()              ← engine constructs and starts the connector
  ↓
connect()            ← open transport; install cron jobs
  ↓
◇ For each cron tick of an enabled item:
  ↓ run(scanMode, items)
  ├── directQueryHandler(items)         ← if SouthDirectQuery
  └── historyQueryHandler(items, …)     ← if SouthHistoryQuery
◇ For subscription items (South only):
  ↓ subscribe() / unsubscribe() reconciled when the item set changes
◇ For North:
  ↓ run(taskDescription) drains one file from the cache, calls handleContent()
  ↓ on success → archive / remove ; on failure → retry / error folder
  ↓
stop()               ← engine signals shutdown
  ↓
disconnect()         ← close transport
```

基类还负责驱动 `metricsEvent` 和 `'connected'` 事件发射器，并处理延迟 Promise
（deferred-promise）的调度，使 `stop()` 能够等待任何正在进行的扫描干净地完成。
在正确的层级重写方法、调用 `super.*`，其余的都会自动完成。

## 测试 {#tests}

连接器的测试文件与类文件放在一起，命名为 `<connector-name>.spec.ts`。团队标准是
**100% 覆盖率**——包括错误路径、重试处理，以及 `testConnection` / `testItem`。现
有连接器提供了充足的参考模式；选择一个接口组合与您相符的连接器，并遵循其测试
文件结构。
