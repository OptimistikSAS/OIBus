---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# Create a new OIBus connector

OIBus connectors are written in [TypeScript](https://www.typescriptlang.org/). **South** connectors _retrieve_
data from a source (PLC, file system, database, MQTT broker, etc.); **North** connectors _deliver_ it to a
destination (file, OIAnalytics, OPC UA server, S3, etc.).

This guide walks through the file layout, the mental model, and the wiring steps required to register a new
connector with the engine.

:::tip Before you start
Reach out to the OIBus team if you're not sure where to begin — what you need might already be supported by an
existing connector, or might be a better fit as an enhancement to one.
:::

## File layout

Each connector lives in its own folder under `backend/src/north/` or `backend/src/south/`:

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

Connectors that share protocol-specific helpers (parsing, certificate handling, socket utilities) typically
extract them to `backend/src/service/utils-<type>.ts` so the connector class stays focused on lifecycle and
orchestration. Examples: `service/utils-opcua.ts`, `service/utils-mqtt.ts`, `service/utils-modbus.ts`.

## Mental model

|                  | **South**                                                    | **North**                                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Direction        | Pulls _from_ a source                                        | Pushes _to_ a destination                        |
| Trigger          | Cron (scan mode), subscription push, or direct query         | Cron-driven _pull_ from a local file cache       |
| Output           | Pushes batches to the engine via `this.addContent(...)`      | Implements `handleContent(fileStream, metadata)` |
| Persistent state | Per-item `trackedInstant` cached for resumable history reads | Per-file cache → archive / error folders         |

South batches are written into the engine's per-North file cache by the engine itself; each North then drains
that cache at its own cadence. This decoupling means a flaky destination doesn't block South ingestion — files
just pile up in the cache and get retried on the next tick.

## Registration steps

Adding a new connector type requires four edits beyond the connector folder. The TypeScript compiler catches
the first three; the fourth is a runtime check.

### 1. Add the type id to the shared list

For a South connector, append your id to `OIBUS_SOUTH_TYPES` in
`backend/shared/model/south-connector.model.ts`:

```typescript title="backend/shared/model/south-connector.model.ts"
export const OIBUS_SOUTH_TYPES = [
  // ...existing types...
  'my-new-source' // ← your new type id (kebab-case)
] as const;
```

North connectors use `OIBUS_NORTH_TYPES` in `backend/shared/model/north-connector.model.ts`.

Pick a `category` from the existing list (`OIBUS_SOUTH_CATEGORIES` or `OIBUS_NORTH_CATEGORIES`). Don't add a
new category unless you have a strong reason — the UI groups connectors by category, and a one-off category
makes that grouping less useful.

### 2. Register in the factory

The factory builds a connector instance from a stored configuration row. Add a `case` for your type:

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

The North equivalent is `buildNorth(...)` in `backend/src/north/north-connector-factory.ts`.

### 3. Map the type id to the generated settings interface name

Settings types (`South<Type>Settings`, `South<Type>ItemSettings`) are generated from the manifest. Tell the
generator how to name them in `backend/src/settings-interface.generator.ts`:

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

Then regenerate from `backend/`:

```bash
npm run generate:settings-interface
```

This reads every `manifest.ts`, derives the corresponding TypeScript interface, and writes it into
`backend/shared/model/south-settings.model.ts` (and the North equivalent). The generator also refreshes the
OpenAPI definitions.

:::caution
On the first run after adding a new type, the generated types don't exist yet — that's expected. After it
finishes, your connector class will compile against the freshly generated types.
:::

### 4. Translation keys

Every `translationKey` in your manifest must resolve to a string in the frontend's i18n bundles
(`frontend/src/assets/i18n/*.json`). The convention is
`configuration.oibus.manifest.<south|north>.<connector-type>.<field>`. Missing keys fall back to the key
itself — the UI keeps working, it just looks rough.

## What's next

- **[The manifest](./manifest.md)** — settings schema, attribute types, validators, conditional display.
- **[The connector class](./class.md)** — base classes, capability interfaces, lifecycle, examples.
