---
displayed_sidebar: developerSidebar
sidebar_position: 3
---

# The connector class

A connector class extends `NorthConnector<TSettings>` or `SouthConnector<TSettings, TItemSettings>` and
overrides a small number of methods. The base classes handle cron jobs, queueing, retry, the local cache, and
the `stop()` / disconnect flow — your subclass focuses on protocol-specific logic.

The two base classes have extensive JSDoc covering every lifecycle method and the contracts between them.
This page is a quick reference; for the deep details read
`backend/src/south/south-connector.ts` and `backend/src/north/north-connector.ts`.

## North connectors

### Minimal complete example

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

### Required methods

| Method                                                 | Purpose                                                                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supportedTypes(): Array<string>`                      | The `contentType` values this North can deliver. **Must agree with the manifest's `types` array.** Unsupported types are routed to the error folder.     |
| `testConnection(): Promise<OIBusConnectionTestResult>` | Probe the destination with current settings. Throw on failure — the message is shown to the user. Return a `{ items: [...] }` of diagnostics on success. |
| `handleContent(fileStream, metadata): Promise<void>`   | Actually deliver one cached payload. May throw — the base class handles retry + the error folder.                                                        |

### Optional overrides

| Method         | When to override                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `connect()`    | Open a long-lived session / socket / HTTP client. Call `super.connect()` once your transport is ready.        |
| `disconnect()` | Close your transport. Call `super.disconnect()` at the end. Must be idempotent (called more than once is OK). |

### Retry semantics

When `handleContent` throws, the file stays in the cache and `errorCount` increments. The base class retries
on the next cron tick. After `caching.error.retryCount` failures the file is moved to the error folder so the
rest of the queue can keep flowing.

For transient errors (network blip, server warming up) you can keep retrying forever by setting `forceRetry`
on the thrown error:

```typescript
import { OIBusError } from '../../shared/model/engine.model';

throw { ...new Error('Connection reset'), forceRetry: true } as OIBusError;
```

`forceRetry` keeps the file in the cache indefinitely — never moved to the error folder.

## South connectors

### Minimal skeleton

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

### Required methods

| Method                                                   | Purpose                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `testConnection(): Promise<OIBusConnectionTestResult>`   | Probe the source. Throw on failure.                                        |
| `testItem(item, testingSettings): Promise<OIBusContent>` | Run one item once for the UI's "test" button. Return the produced content. |

### Optional overrides

Same as North: `connect()` and `disconnect()`. **Always call `super.*` at the end** of your override so cron
state, subscription bookkeeping, and the `'connected'` event are kept in sync.

### Capability interfaces (South only)

A South connector implements one or more of three capability interfaces from `south-interface.ts`. The base
class detects them with structural `in`-checks at runtime — you don't need to declare a flag.

#### `SouthDirectQuery`

For one-shot reads — e.g. Modbus register read, REST API call, "get current value".

```typescript
interface SouthDirectQuery {
  directQuery(items: Array<SouthConnectorItemEntity<...>>): Promise<unknown | null>;
}
```

The base class calls `directQuery()` for each scan-mode tick. Push the actual readings to the engine via
`this.addContent(...)` before returning, and return the last value so the UI can display it.

Example: `backend/src/south/south-modbus/south-modbus.ts`.

#### `SouthHistoryQuery`

For time-windowed reads — e.g. OPC UA HistoryRead, SQL `BETWEEN`, OSIsoft PI archive.

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

The base class plans the window:

- `startTime` / `endTime` — the natural range for this tick.
- `startTimeFromCache` — the start that accounts for already-fetched data. Use it to construct the actual
  query window so a restart doesn't re-query history. The `startTime` is preserved separately so an error
  during one interval doesn't lose track of where the original range began.

Return the timestamp of the most recent value retrieved as `trackedInstant`; the base class persists it so
the next call resumes from there. Return `{ trackedInstant: null, value: null }` if nothing was retrieved.

Example: `backend/src/south/south-opcua/south-opcua.ts`.

#### `SouthSubscription`

For push-driven sources — MQTT, OPC UA subscription, anything event-based.

```typescript
interface SouthSubscription {
  subscribe(items: Array<SouthConnectorItemEntity<...>>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemEntity<...>>): Promise<void>;
}
```

The base class calls `subscribe()` and `unsubscribe()` whenever the configured-item set diverges from the
currently-subscribed set. When data arrives, push it via `this.addContent(...)` directly from your event
handler.

Subscription items are identified by their reserved scan mode id `'subscription'`. The manifest must allow
`'SUBSCRIPTION'` or `'SUBSCRIPTION_AND_POLL'` on the item's `scanMode` for the UI to let operators pick it.

Examples: `backend/src/south/south-mqtt/south-mqtt.ts` (subscription-only),
`backend/src/south/south-opcua/south-opcua.ts` (all three).

A single connector class can implement any combination of the three interfaces; the base class fans out
appropriately per scan tick.

### Pushing data — `addContent`

```typescript
await this.addContent(
  content, // OIBusContent (discriminated union by `type`)
  queryTime, // Instant — when this batch was fetched
  items // the items that produced it; used for metadata + transformer routing
);
```

`OIBusContent` is a discriminated union:

| `type`          | `content` shape                                                               | Use for                                     |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| `'time-values'` | `Array<OIBusTimeValue>` — `{ pointId, timestamp, data: { value, quality? } }` | Most numeric / textual time-series data     |
| `'any-content'` | `string` — an opaque serialised payload (e.g. JSON-stringified MQTT messages) | When the destination needs the raw payload  |
| `'any'`         | `{ filePath: string }` — a file already written to disk                       | File-based connectors (folder scanner, FTP) |

The engine takes care of writing the content into each enabled North's cache via its transformer pipeline.
Don't write to the cache directly — always go through `addContent`.

## Lifecycle

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

The base class also drives the `metricsEvent` and `'connected'` event emitters, and handles the
deferred-promise dance so `stop()` waits for any in-flight scan to complete cleanly. Override at the right
level, call `super.*`, and the rest is automatic.

## Tests

Connector specs live alongside the class file as `<connector-name>.spec.ts`. The team standard is **100%
coverage** — including error paths, retry handling, and `testConnection` / `testItem`. Existing connectors
provide ample reference patterns; pick one whose interface mix matches yours and follow its spec structure.
