---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# The manifest

The manifest is a TypeScript file (typed as `SouthConnectorManifest` or `NorthConnectorManifest`) that
declares:

- **What the connector is** — id, category, supported modes (South) or content types (North)
- **What settings the operator can configure** — connection URL, credentials, protocol-specific options
- **For South: what an item looks like** — which value to query, scan-mode acceptability, item-specific
  settings

The frontend renders the manifest as a form; the backend type-generator produces the corresponding TypeScript
interfaces (`South<Type>Settings`, `South<Type>ItemSettings`, `North<Type>Settings`).

## Top-level shape

### South

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
  settings: {
    /* OIBusObjectAttribute — see below */
  },
  items: {
    /* OIBusArrayAttribute — see below */
  }
};

export default manifest;
```

The `modes` flags are _advisory_ — they tell the UI which actions to expose (e.g. whether to show
"create history query" for this connector type). The actual runtime capability is determined by which
interfaces from `south-interface.ts` the class implements; see
[the class doc](./class.md#capability-interfaces-south-only).

### North

```typescript title="backend/src/north/north-console/manifest.ts"
import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console', // must be in OIBUS_NORTH_TYPES
  category: 'debug', // 'debug' | 'api' | 'file' | 'iot'
  types: ['any', 'time-values', 'setpoint'], // content types this North can deliver
  settings: {
    /* OIBusObjectAttribute */
  }
};

export default manifest;
```

North doesn't have `items`. The `types` array MUST agree with what the class returns from
`supportedTypes()` — the engine checks at runtime and routes unsupported types to the error folder.

## The settings object

`settings` is always an `OIBusObjectAttribute`:

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

Each child in `attributes` is one form control. Containers (`object`, `array`) can themselves contain more
attributes — nesting is unlimited.

### Attribute types

| `type`            | UI element              | Generated TypeScript type | Extra fields                                                                    |
| ----------------- | ----------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `'string'`        | Text input              | `string \| null`          | `defaultValue`                                                                  |
| `'number'`        | Numeric input           | `number \| null`          | `defaultValue`, `unit` (e.g. `'ms'`, `'MB'`)                                    |
| `'boolean'`       | Toggle / checkbox       | `boolean`                 | `defaultValue`                                                                  |
| `'secret'`        | Password input (masked) | `string \| null`          | (encrypted at rest by OIBus)                                                    |
| `'string-select'` | Dropdown                | `string \| null`          | `selectableValues: Array<string>`, `defaultValue`                               |
| `'code'`          | Codemirror editor       | `string \| null`          | `contentType: 'sql' \| 'json'`, `defaultValue`                                  |
| `'instant'`       | Date+time picker        | `Instant \| null`         | —                                                                               |
| `'timezone'`      | Timezone select         | `string \| null`          | `defaultValue`                                                                  |
| `'scan-mode'`     | Scan-mode select        | `ScanMode`                | `acceptableType: 'POLL' \| 'SUBSCRIPTION' \| 'SUBSCRIPTION_AND_POLL'`           |
| `'certificate'`   | Certificate selector    | `string \| null`          | —                                                                               |
| `'object'`        | Group container         | nested object             | `attributes`, `displayProperties: { visible, wrapInBox }`, `enablingConditions` |
| `'array'`         | Repeatable rows         | `Array<T>`                | `paginate`, `numberOfElementPerPage`, `rootAttribute`                           |

Every leaf attribute carries the same common fields:

| Field               | Purpose                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `key`               | camelCase field name — becomes the TypeScript property                                             |
| `translationKey`    | i18n key for the label                                                                             |
| `validators`        | Array of `{ type, arguments }` — see below                                                         |
| `displayProperties` | `{ row, columns, displayInViewMode }` for leaf attributes, or `{ visible, wrapInBox }` for objects |

### A concrete example

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

### Validators

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

Validator arguments are always strings; the frontend parses them per validator type.

Hidden fields (see [enabling conditions](#enabling-conditions)) skip their validators — a required-but-hidden
field won't block form submission.

### Enabling conditions

Show or hide attributes based on the value of another field. Declared on the **parent object**, not on each
attribute:

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

Paths are dotted, relative to the **enclosing object's root** (not the form root).

## Items (South only)

`items` describes the per-item sub-form. It's an `OIBusArrayAttribute` whose `rootAttribute` is the
`OIBusObjectAttribute` defining one row:

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

The `scanMode.acceptableType` controls what the operator can pick:

| Value                     | Effect                                                                            |
| ------------------------- | --------------------------------------------------------------------------------- |
| `'POLL'`                  | Periodic only (default for most South connectors)                                 |
| `'SUBSCRIPTION'`          | Push-driven only — use when the connector ONLY supports subscriptions (e.g. MQTT) |
| `'SUBSCRIPTION_AND_POLL'` | Either is valid per item (OPC UA: some items polled, some subscribed)             |

A complete real example is `backend/src/south/south-folder-scanner/manifest.ts`.

## Generating the TypeScript types

After editing the manifest, regenerate the typed settings interfaces from `backend/`:

```bash
npm run generate:settings-interface
```

The script reads every `manifest.ts`, derives the corresponding TypeScript type, and writes it into
`backend/shared/model/south-settings.model.ts` (and the North equivalent). It also refreshes the OpenAPI
definitions.

:::caution Schema changes are breaking
If you change a field's `key`, `type`, or position in its parent's `attributes` array, the generated
interface changes. Existing connector configurations saved to the database may need a migration —
add one in `backend/src/migration/entity-migrations/`.
:::
