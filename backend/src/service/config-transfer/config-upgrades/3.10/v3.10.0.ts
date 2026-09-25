import { generateRandomId } from '../../../utils';
import recordListToCsvManifest from '../../../../transformers/any/record-list-to-csv/manifest';
import { ConfigUpgrade, forEachHistoryQuery, forEachNorth, forEachSouth, JsonObject } from '../config-upgrade';

/**
 * The 3.10.0 changes to the configuration, shared with the entity migration doing the same to existing
 * installs (`migration/entity-migrations/3/3.10/v3.10.0.ts`, which documents each of them).
 *
 * Unlike its migration, the step only rewrites what is still in the old shape: an export from a
 * 3.10.0 pre-release is upgraded by it too, and may already have (part of) the new one.
 */

// The SQL-family souths reworked to emit 'record-list' content instead of pre-serialized CSV.
// south-odbc and south-oledb are intentionally excluded (their CSV building happens in an external
// .NET agent, outside this refactor's scope).
export const SQL_SOUTH_TYPES = ['mysql', 'postgresql', 'mssql', 'oracle', 'sqlite'];

// "IoT family" south connector types at 3.10.0: the only ones for which a per-item caching strategy
// is meaningful, defaulted to 'allValues'.
export const IOT_FAMILY_SOUTH_TYPES = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt'];

// Standard transformers producing 'oianalytics' content, which gain the `referenceProcess` option.
export const OIANALYTICS_TRANSFORMER_FUNCTION_NAMES = ['time-values-to-oianalytics', 'json-to-oianalytics'];

export const RECORD_LIST_TO_CSV_FUNCTION_NAME = 'record-list-to-csv';

interface OldDateTimeField {
  fieldName: string;
  useAsReference: boolean;
  type: string;
  timezone?: string | null;
  format?: string | null;
  locale?: string | null;
}

interface OldSerialization {
  type: 'csv';
  filename: string;
  delimiter: string;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: string;
}

export interface OldSqlItemSettings {
  dateTimeFields?: Array<OldDateTimeField> | null;
  serialization?: OldSerialization;
  [key: string]: unknown;
}

/**
 * Converts one SQL item's old settings: drops `dateTimeFields`/`serialization`, adds `trackingInstant`
 * derived from whichever dateTimeFields entry (if any) had `useAsReference: true`.
 */
export function toNewSqlItemSettings(oldSettings: OldSqlItemSettings): Record<string, unknown> {
  const { dateTimeFields: _dateTimeFields, serialization: _serialization, ...rest } = oldSettings;
  const referenceField = oldSettings.dateTimeFields?.find(field => field.useAsReference) ?? null;
  return {
    ...rest,
    trackingInstant: referenceField
      ? {
          trackInstant: true,
          fieldName: referenceField.fieldName,
          dateTimeInput: {
            type: referenceField.type,
            timezone: referenceField.timezone ?? null,
            format: referenceField.format ?? null,
            locale: referenceField.locale ?? null
          }
        }
      : { trackInstant: false }
  };
}

/**
 * Builds the options for a `record-list-to-csv` transformer that reproduces one SQL item's old CSV
 * output: same filename/delimiter/compression, and every old dateTimeFields entry (not just the
 * reference one — the original code rendered all of them) becomes a `fields` entry with
 * `dataType: 'datetime'`, sharing the item's old `outputTimestampFormat`/`outputTimezone`. Columns
 * with no entry in `fields` pass through unchanged, same as before.
 */
export function buildRecordListToCsvOptions(oldSettings: OldSqlItemSettings): Record<string, unknown> {
  const serialization = oldSettings.serialization;
  return {
    filename: serialization?.filename ?? '@CurrentDate.csv',
    encoding: 'UTF_8',
    header: true,
    compression: serialization?.compression ?? false,
    delimiter: serialization?.delimiter ?? 'COMMA',
    newline: 'LF',
    quoteChar: 'NONE',
    escapeChar: 'DOUBLE_QUOTE',
    nullValue: '',
    fields: (oldSettings.dateTimeFields ?? []).map(field => ({
      fieldName: field.fieldName,
      columnName: null,
      dataType: 'datetime',
      fieldProcess: null,
      datetimeSettings: {
        inputType: field.type,
        inputTimezone: field.timezone ?? null,
        inputFormat: field.format ?? null,
        inputLocale: field.locale ?? null,
        outputType: 'string',
        outputTimezone: serialization?.outputTimezone ?? 'UTC',
        outputFormat: serialization?.outputTimestampFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS',
        outputLocale: null
      }
    }))
  };
}

/**
 * Whether the transformer an existing (north, item) resolves to keeps it as is once its SQL south emits
 * record lists: 'ignore' and every other transformer are a deliberate choice, but no transformer at
 * all, or 'iso' (which only behaved like the old CSV export because the south itself produced CSV
 * bytes), needs a `record-list-to-csv` transformer.
 */
export function keepsResolvedTransformer(resolvedFunctionName: string | null | undefined): boolean {
  return resolvedFunctionName !== undefined && resolvedFunctionName !== 'iso';
}

const asObjects = (value: unknown): Array<JsonObject> => (Array.isArray(value) ? (value as Array<JsonObject>) : []);
const setMissing = (object: JsonObject, key: string, value: unknown): void => {
  if (object[key] === undefined) object[key] = value;
};
// A 3.9 SQL item always has `serialization` (the 3.9 manifests required it); its absence does not mean the
// item already has the 3.10 shape, since `trackingInstant` is optional
const isOldSqlItem = (item: JsonObject): boolean => {
  const settings = item.settings as JsonObject;
  return settings.serialization !== undefined || settings.dateTimeFields !== undefined;
};
const itemLight = (item: JsonObject) => ({ id: item.id, name: item.name, enabled: item.enabled });

/**
 * Resolves transformer links to the function name of the transformer they use — null for a custom (or
 * unknown) transformer — and provides the `record-list-to-csv` standard transformer, added to the
 * configuration the first time it is needed if the configuration does not describe it.
 */
function transformerCatalog(config: JsonObject): {
  functionName: (transformerId: unknown) => string | null;
  recordListToCsvId: () => string;
} {
  const transformers = asObjects(config.transformers);
  const functionName = (transformerId: unknown): string | null => {
    const transformer = transformers.find(candidate => candidate.oIBusInternalId === transformerId);
    return transformer?.type === 'standard' ? ((transformer.settings as JsonObject).functionName as string) : null;
  };
  const recordListToCsvId = (): string => {
    const existing = transformers.find(
      candidate => candidate.type === 'standard' && (candidate.settings as JsonObject).functionName === RECORD_LIST_TO_CSV_FUNCTION_NAME
    );
    if (existing) return existing.oIBusInternalId as string;
    const added = {
      oIBusInternalId: generateRandomId(6),
      type: 'standard',
      settings: { functionName: RECORD_LIST_TO_CSV_FUNCTION_NAME, inputType: 'record-list', outputType: 'any' },
      manifest: recordListToCsvManifest.settings
    };
    transformers.push(added);
    config.transformers = transformers;
    return added.oIBusInternalId;
  };
  return { functionName, recordListToCsvId };
}

/**
 * SQL south items: converts their settings, and attaches a `record-list-to-csv` transformer to every
 * north where the transformer they currently resolve to (item, then group, then south level; the first
 * matching link wins, as in `NorthConnector`) does not keep them as is.
 */
function migrateSqlSouthItems(config: JsonObject, catalog: ReturnType<typeof transformerCatalog>): void {
  const norths = asObjects(config.northConnectors);
  for (const south of asObjects(config.southConnectors)) {
    if (!SQL_SOUTH_TYPES.includes(south.type as string)) continue;
    const items = asObjects((south.settings as JsonObject).items).filter(isOldSqlItem);
    if (items.length === 0) continue;

    // Resolved on the links existing before any is added
    const resolutions = norths.map(north => {
      const links = asObjects((north.settings as JsonObject).transformers).filter(link => {
        const source = link.source as JsonObject;
        return source.type === 'south' && source.southId === south.oIBusInternalId;
      });
      const itemLevel = new Map<unknown, JsonObject>();
      const groupLevel = new Map<unknown, JsonObject>();
      let southLevel: JsonObject | undefined;
      for (const link of links) {
        const source = link.source as JsonObject;
        const linkedItems = asObjects(source.items);
        if (source.groupId) {
          if (!groupLevel.has(source.groupId)) groupLevel.set(source.groupId, link);
        } else if (linkedItems.length > 0) {
          for (const linkedItem of linkedItems) {
            if (!itemLevel.has(linkedItem.id)) itemLevel.set(linkedItem.id, link);
          }
        } else {
          southLevel ??= link;
        }
      }
      return {
        north,
        resolve: (item: JsonObject) => itemLevel.get(item.id) ?? (item.groupId ? groupLevel.get(item.groupId) : undefined) ?? southLevel
      };
    });

    for (const item of items) {
      const oldSettings = item.settings as OldSqlItemSettings;
      for (const { north, resolve } of resolutions) {
        const resolved = resolve(item);
        if (keepsResolvedTransformer(resolved ? catalog.functionName(resolved.transformerId) : undefined)) continue;
        (north.settings as JsonObject).transformers = [
          ...asObjects((north.settings as JsonObject).transformers),
          {
            id: generateRandomId(6),
            transformerId: catalog.recordListToCsvId(),
            options: buildRecordListToCsvOptions(oldSettings),
            source: { type: 'south', southId: south.oIBusInternalId, items: [itemLight(item)] }
          }
        ];
      }
      item.settings = toNewSqlItemSettings(oldSettings);
    }
  }
}

/** Same as `migrateSqlSouthItems` for SQL history queries, which have no group level. */
function migrateSqlHistoryQueryItems(config: JsonObject, catalog: ReturnType<typeof transformerCatalog>): void {
  forEachHistoryQuery(config, null, settings => {
    if (!SQL_SOUTH_TYPES.includes(settings.southType as string)) return;
    const items = asObjects(settings.items).filter(isOldSqlItem);
    if (items.length === 0) return;

    const links = asObjects(settings.northTransformers);
    const itemLevel = new Map<unknown, JsonObject>();
    let historyLevel: JsonObject | undefined;
    for (const link of links) {
      const linkedItems = asObjects(link.items);
      if (linkedItems.length > 0) {
        for (const linkedItem of linkedItems) {
          if (!itemLevel.has(linkedItem.id)) itemLevel.set(linkedItem.id, link);
        }
      } else {
        historyLevel ??= link;
      }
    }

    for (const item of items) {
      const oldSettings = item.settings as OldSqlItemSettings;
      const resolved = itemLevel.get(item.id) ?? historyLevel;
      if (!keepsResolvedTransformer(resolved ? catalog.functionName(resolved.transformerId) : undefined)) {
        settings.northTransformers = [
          ...asObjects(settings.northTransformers),
          {
            id: generateRandomId(6),
            transformerId: catalog.recordListToCsvId(),
            options: buildRecordListToCsvOptions(oldSettings),
            items: [itemLight(item)]
          }
        ];
      }
      item.settings = toNewSqlItemSettings(oldSettings);
    }
  });
}

export const upgrade: ConfigUpgrade = {
  version: '3.10.0',
  description:
    'Add scan mode scheduling types, certificate chains, item caching strategies and configuration workflows; ' +
    'move SQL items CSV serialization to record-list-to-csv transformers',
  apply: config => {
    const catalog = transformerCatalog(config);

    for (const scanMode of asObjects(config.scanModes)) {
      const settings = scanMode.settings as JsonObject;
      setMissing(settings, 'type', 'cron');
      setMissing(settings, 'interval', null);
      setMissing(settings, 'activationWindow', null);
    }
    for (const certificate of asObjects(config.certificates)) {
      setMissing(certificate.settings as JsonObject, 'certificateChain', null);
    }

    migrateSqlSouthItems(config, catalog);
    migrateSqlHistoryQueryItems(config, catalog);

    const engineSettings = (config.engine as JsonObject | undefined)?.settings as JsonObject | undefined;
    if (engineSettings) {
      setMissing(engineSettings, 'auditRetentionDuration', 90);
      if (engineSettings.logger) setMissing(engineSettings.logger as JsonObject, 'auditRetentionDuration', 90);
    }

    forEachSouth(config, null, south => {
      const settings = south.settings as JsonObject;
      setMissing(settings, 'configurationWorkflows', []);
      const defaultCachingStrategy = IOT_FAMILY_SOUTH_TYPES.includes(south.type as string) ? 'allValues' : null;
      for (const item of asObjects(settings.items)) {
        setMissing(item, 'cachingStrategy', defaultCachingStrategy);
        for (const key of ['thresholdType', 'threshold', 'rangeLow', 'rangeHigh', 'maxCachingInterval']) {
          setMissing(item, key, null);
        }
      }
      for (const group of asObjects(settings.groups)) {
        setMissing(group.historySettings as JsonObject, 'cachingStrategy', defaultCachingStrategy);
      }
    });

    const addReferenceProcess = (link: JsonObject): void => {
      if (!OIANALYTICS_TRANSFORMER_FUNCTION_NAMES.includes(catalog.functionName(link.transformerId) ?? '')) return;
      link.options = { ...((link.options as JsonObject | null) ?? {}) };
      setMissing(link.options as JsonObject, 'referenceProcess', null);
    };
    forEachNorth(config, null, north => asObjects((north.settings as JsonObject).transformers).forEach(addReferenceProcess));
    forEachHistoryQuery(config, null, settings => asObjects(settings.northTransformers).forEach(addReferenceProcess));

    return config;
  }
};
