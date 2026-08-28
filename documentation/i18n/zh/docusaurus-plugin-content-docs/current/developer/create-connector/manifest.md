---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# 清单（manifest）

清单是一个 TypeScript 文件（类型为 `SouthConnectorManifest` 或 `NorthConnectorManifest`），
用于声明：

- **连接器是什么** — id、类别、支持的模式（South）或内容类型（North）
- **操作人员可以配置哪些设置** — 连接 URL、凭据、协议相关的选项
- **仅限 South：一个条目（item）是什么样的** — 要查询哪个值、扫描模式的可接受
  性、条目专属的设置

前端将清单渲染为一个表单；后端的类型生成器则生成对应的 TypeScript
接口（`South<Type>Settings`、`South<Type>ItemSettings`、`North<Type>Settings`）。

## 顶层结构 {#top-level-shape}

### South {#south}

```typescript title="backend/src/south/south-folder-scanner/manifest.ts (excerpt)"
import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'folder-scanner', // must be in OIBUS_SOUTH_TYPES
  category: 'file', // 'file' | 'iot' | 'database' | 'api'
  modes: {
    subscription: false, // class implements SouthSubscription?
    lastPoint: false, // class implements SouthDirectQuery for a point?
    lastFile: true, // class implements SouthDirectQuery for a file?
    history: false // class implements SouthHistoryQuery?
  },
  settings: {/* OIBusObjectAttribute — see below */},
  items: {/* OIBusArrayAttribute — see below */}
};

export default manifest;
```

`modes` 标志是 _建议性的_ ——它们告诉 UI 应该展示哪些操作（例如是否为该连接器
类型显示“创建历史查询”）。实际的运行时能力是由类实现了
`south-interface.ts` 中的哪些接口决定的；参见
[连接器类文档](./class.md#capability-interfaces-south-only)。

### North {#north}

```typescript title="backend/src/north/north-console/manifest.ts"
import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console', // must be in OIBUS_NORTH_TYPES
  category: 'debug', // 'debug' | 'api' | 'file' | 'iot'
  types: ['any', 'time-values', 'setpoint'], // content types this North can deliver
  settings: {/* OIBusObjectAttribute */}
};

export default manifest;
```

North 没有 `items`。`types` 数组必须与类的 `supportedTypes()` 返回值一致——
引擎会在运行时进行检查，并将不受支持的类型路由到错误文件夹。

## settings 对象 {#the-settings-object}

`settings` 始终是一个 `OIBusObjectAttribute`：

```typescript
{
  type: 'object',
  key: 'settings',
  translationKey: 'configuration.oibus.manifest.<south|north>.settings',
  displayProperties: { visible: true, wrapInBox: false },
  enablingConditions: [],
  validators: [],
  attributes: [ /* child attributes — your form fields */ ]
}
```

`attributes` 中的每个子项都是一个表单控件。容器类型（`object`、`array`）本身
可以包含更多属性——嵌套没有层数限制。

### 属性类型 {#attribute-types}

| `type`            | UI 元素                  | 生成的 TypeScript 类型     | 额外字段                                                                        |
| ------------------ | ------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| `'string'`        | 文本输入框                | `string \| null`          | `defaultValue`                                                                  |
| `'number'`        | 数字输入框                | `number \| null`          | `defaultValue`、`unit`（例如 `'ms'`、`'MB'`）                                    |
| `'boolean'`       | 开关 / 复选框             | `boolean`                 | `defaultValue`                                                                  |
| `'secret'`        | 密码输入框（掩码显示）     | `string \| null`          | （由 OIBus 加密存储）                                                            |
| `'string-select'` | 下拉选择框                | `string \| null`          | `selectableValues: Array<string>`、`defaultValue`                               |
| `'code'`          | Codemirror 编辑器         | `string \| null`          | `contentType: 'sql' \| 'json'`、`defaultValue`                                  |
| `'instant'`       | 日期+时间选择器           | `Instant \| null`         | —                                                                               |
| `'timezone'`      | 时区选择框                | `string \| null`          | `defaultValue`                                                                  |
| `'scan-mode'`     | 扫描模式选择框             | `ScanMode`                | `acceptableType: 'POLL' \| 'SUBSCRIPTION' \| 'SUBSCRIPTION_AND_POLL'`           |
| `'certificate'`   | 证书选择器                | `string \| null`          | —                                                                               |
| `'object'`        | 分组容器                  | 嵌套对象                    | `attributes`、`displayProperties: { visible, wrapInBox }`、`enablingConditions` |
| `'array'`         | 可重复的行                | `Array<T>`                | `paginate`、`numberOfElementPerPage`、`rootAttribute`                           |

每个叶子属性都带有相同的通用字段：

| 字段                 | 用途                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `key`                | camelCase 字段名——将成为 TypeScript 属性名                                               |
| `translationKey`     | 标签的 i18n key                                                                           |
| `validators`         | `{ type, arguments }` 数组——见下文                                                       |
| `displayProperties`  | 叶子属性使用 `{ row, columns, displayInViewMode }`；对象则使用 `{ visible, wrapInBox }`   |

### 一个具体示例 {#a-concrete-example}

```typescript title="One simple string attribute"
{
  type: 'string',
  key: 'inputFolder',
  translationKey: 'configuration.oibus.manifest.south.folder-scanner.input-folder',
  defaultValue: './input/',
  validators: [
    { type: 'REQUIRED', arguments: [] }
  ],
  displayProperties: {
    row: 0,        // 0-indexed row in the form
    columns: 12,   // Bootstrap-style 12-column grid → 12 = full width
    displayInViewMode: true
  }
}
```

```typescript title="A select with three options"
{
  type: 'string-select',
  key: 'authenticationType',
  translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.type',
  selectableValues: ['none', 'basic', 'cert'],
  defaultValue: 'none',
  validators: [{ type: 'REQUIRED', arguments: [] }],
  displayProperties: { row: 2, columns: 4, displayInViewMode: false }
}
```

```typescript title="A secret that's only required when auth = basic"
// Declared as a sibling of authenticationType; visibility is controlled by an
// enablingCondition on the PARENT object (see below).
{
  type: 'secret',
  key: 'password',
  translationKey: 'configuration.oibus.manifest.south.mqtt.authentication.password',
  validators: [{ type: 'REQUIRED', arguments: [] }],
  displayProperties: { row: 3, columns: 4, displayInViewMode: false }
}
```

### 校验器（Validators） {#validators}

```typescript
validators: [
  { type: 'REQUIRED', arguments: [] },
  { type: 'MINIMUM', arguments: ['1'] }, // numeric, e.g. number must be ≥ 1
  { type: 'MAXIMUM', arguments: ['65535'] },
  { type: 'POSITIVE_INTEGER', arguments: [] },
  { type: 'VALID_CRON', arguments: [] },
  { type: 'PATTERN', arguments: ['^[A-Z]{3}-\\d+$'] }, // regex; backslashes need escaping
  { type: 'UNIQUE', arguments: [] }, // value unique within the parent array
  { type: 'SINGLE_TRUE', arguments: [] }, // exactly one sibling boolean may be true
  { type: 'MQTT_TOPIC_OVERLAP', arguments: [] } // MQTT-specific: no overlapping topics in an array
];
```

校验器参数始终是字符串；前端会按校验器类型分别解析它们。

隐藏字段（参见[启用条件](#enabling-conditions)）会跳过其校验器——一个必填但
被隐藏的字段不会阻止表单提交。

### 启用条件 {#enabling-conditions}

根据另一个字段的值来显示或隐藏属性。声明在**父对象**上，而不是每个属性上：

```typescript title="Show 'username' and 'password' only when authentication.type === 'basic'"
{
  type: 'object',
  key: 'authentication',
  translationKey: 'configuration.oibus.manifest.south.mqtt.authentication',
  displayProperties: { visible: true, wrapInBox: true },
  enablingConditions: [
    {
      referralPathFromRoot: 'authentication.type',
      targetPathFromRoot: 'authentication.username',
      values: ['basic'],
      operator: 'EQUALS'  // optional: 'EQUALS' (default) | 'NOT_EQUAL' | 'CONTAINS'
    },
    {
      referralPathFromRoot: 'authentication.type',
      targetPathFromRoot: 'authentication.password',
      values: ['basic']
    }
  ],
  validators: [],
  attributes: [
    { type: 'string-select', key: 'type', /* ... */ },
    { type: 'string', key: 'username', /* ... */ },
    { type: 'secret', key: 'password', /* ... */ }
  ]
}
```

路径是点分隔的，相对于**所在对象的根**（而不是整个表单的根）。

## 条目（items，仅限 South） {#items-south-only}

`items` 描述了每个条目的子表单。它是一个 `OIBusArrayAttribute`，其
`rootAttribute` 是定义单行的 `OIBusObjectAttribute`：

```typescript title="Typical items shape"
items: {
  type: 'array',
  key: 'items',
  translationKey: 'configuration.oibus.manifest.south.items',
  paginate: true,
  numberOfElementPerPage: 20,
  validators: [],
  rootAttribute: {
    type: 'object',
    key: 'item',
    translationKey: 'configuration.oibus.manifest.south.items.item',
    displayProperties: { visible: true, wrapInBox: false },
    enablingConditions: [],
    validators: [],
    attributes: [
      // The three always-present item attributes:
      { type: 'string',  key: 'name',     /* required, unique */ },
      { type: 'boolean', key: 'enabled',  defaultValue: true, /* ... */ },
      {
        type: 'scan-mode',
        key: 'scanMode',
        acceptableType: 'POLL',           // 'POLL' | 'SUBSCRIPTION' | 'SUBSCRIPTION_AND_POLL'
        translationKey: 'configuration.oibus.manifest.south.items.scan-mode',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },

      // Connector-specific settings under a nested object:
      {
        type: 'object',
        key: 'settings',
        translationKey: 'configuration.oibus.manifest.south.items.settings',
        displayProperties: { visible: true, wrapInBox: true },
        enablingConditions: [],
        validators: [],
        attributes: [
          // your item-specific fields here
        ]
      }
    ]
  }
}
```

`scanMode.acceptableType` 控制操作人员可以选择的内容：

| 值                        | 效果                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `'POLL'`                  | 仅周期性触发（大多数 South 连接器的默认值）                                        |
| `'SUBSCRIPTION'`          | 仅推送驱动——用于该连接器**只**支持订阅的场景（例如 MQTT）                         |
| `'SUBSCRIPTION_AND_POLL'` | 每个条目均可选择其一（OPC UA：部分条目轮询，部分条目订阅）                        |

一个完整的真实示例是 `backend/src/south/south-folder-scanner/manifest.ts`。

## 生成 TypeScript 类型 {#generating-the-typescript-types}

编辑完清单后，从 `backend/` 目录重新生成类型化的设置接口：

```bash
npm run generate:settings-interface
```

该脚本会读取每一个 `manifest.ts`，推导出对应的 TypeScript 类型，并写入
`backend/shared/model/south-settings.model.ts`（以及 North 对应的文件）。它还会
刷新 OpenAPI 定义。

:::caution Schema changes are breaking
如果您更改了某个字段在其父级 `attributes` 数组中的 `key`、`type` 或位置，生成的
接口就会发生变化。已保存到数据库中的现有连接器配置可能需要迁移——
在 `backend/src/migration/entity-migrations/` 中添加一个迁移。
:::
