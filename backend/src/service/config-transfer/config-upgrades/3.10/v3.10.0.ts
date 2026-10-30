import path from 'node:path';

import fileToFileManifest from '../../../../transformers/file/file-to-file/manifest';
import fileToMqttManifest from '../../../../transformers/file/file-to-mqtt/manifest';
import fileToOianalyticsManifest from '../../../../transformers/file/file-to-oianalytics/manifest';
import fileToRecordListManifest from '../../../../transformers/file/file-to-record-list/manifest';
import recordListToFileManifest from '../../../../transformers/record-list/record-list-to-file/manifest';
import recordListToModbusManifest from '../../../../transformers/record-list/record-list-to-modbus/manifest';
import recordListToMqttManifest from '../../../../transformers/record-list/record-list-to-mqtt/manifest';
import recordListToOianalyticsManifest from '../../../../transformers/record-list/record-list-to-oianalytics/manifest';
import recordListToOpcuaManifest from '../../../../transformers/record-list/record-list-to-opcua/manifest';
import { generateRandomId } from '../../../utils';
import {
  ConfigUpgrade,
  forEachHistoryQuery,
  forEachHistoryQueryItem,
  forEachNorth,
  forEachSouth,
  forEachSouthItem,
  JsonObject
} from '../config-upgrade';
import {
  FILE_PASSTHROUGH,
  IGNORE_FUNCTION_NAME,
  ISO_FUNCTION_NAME,
  Passthrough,
  passthroughFor,
  planRouting,
  planSourceRouting,
  RoutingPlan,
  SETPOINT_PASSTHROUGH,
  southContentType
} from './passthrough-transformers';

/**
 * The 3.10.0 changes to the configuration, shared with the entity migration doing the same to existing
 * installs (`migration/entity-migrations/3/3.10/v3.10.0.ts`, which documents each of them).
 *
 * Unlike its migration, the step only rewrites what is still in the old shape: an export from a
 * 3.10.0 pre-release is upgraded by it too, and may already have (part of) the new one.
 */

// The SQL-family souths reworked to emit 'record-list' content instead of pre-serialized CSV. With a remote agent
// (always for OLEDB, optional for ODBC), the agent still builds a CSV, which the connector parses back into records.
export const SQL_SOUTH_TYPES = ['mysql', 'postgresql', 'mssql', 'oracle', 'sqlite', 'odbc', 'oledb'];

/**
 * Whether the south queries its database through the OIBus remote agent. The agent only formats the reference date
 * time field (now sent as an ISO string), and leaves the other fields as they are.
 */
export function usesRemoteAgent(southType: string, southSettings: { remoteAgent?: unknown } | null | undefined): boolean {
  return southType === 'oledb' || (southType === 'odbc' && southSettings?.remoteAgent === true);
}

// "IoT family" south connector types at 3.10.0: the only ones for which a per-item caching strategy
// is meaningful, defaulted to 'allValues'.
export const IOT_FAMILY_SOUTH_TYPES = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt'];

/** South types supporting history queries, whose items and groups gain an empty interval strategy. */
export const HISTORY_SOUTH_TYPES = [
  'bacnet',
  'influxdb',
  'mongodb',
  'mssql',
  'mysql',
  'odbc',
  'oianalytics',
  'oledb',
  'opc',
  'opcua',
  'oracle',
  'osisoft-pi',
  'postgresql',
  'rest',
  'sqlite'
];

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
            ...toStringDateTimeSettings(referenceField, ['timezone', 'format', 'locale'])
          }
        }
      : { trackInstant: false }
  };
}

/**
 * The timezone, format and locale of an old date time field under the given keys: kept only for the string type, the
 * only one using them, and only when set. The forms leave them out otherwise, and the API rejects them as null.
 */
function toStringDateTimeSettings(field: OldDateTimeField, keys: [string, string, string]): Record<string, string> {
  const settings: Record<string, string> = {};
  if (field.type !== 'string') return settings;
  const values = [field.timezone, field.format, field.locale];
  keys.forEach((key, index) => {
    if (values[index] != null) settings[key] = values[index];
  });
  return settings;
}

/**
 * Builds the options for a `record-list-to-csv` transformer that reproduces one SQL item's old CSV
 * output: same filename/delimiter/compression, and every old dateTimeFields entry (not just the
 * reference one — the original code rendered all of them) becomes a `fields` entry with
 * `dataType: 'datetime'`, sharing the item's old `outputTimestampFormat`/`outputTimezone`. Columns
 * with no entry in `fields` pass through unchanged, same as before.
 * Through a remote agent, only the reference field was formatted, and it now comes as an ISO string.
 */
export function buildRecordListToCsvOptions(oldSettings: OldSqlItemSettings, viaRemoteAgent = false): Record<string, unknown> {
  const serialization = oldSettings.serialization;
  const dateTimeFields = (oldSettings.dateTimeFields ?? [])
    .filter(field => !viaRemoteAgent || field.useAsReference)
    .map(field => (viaRemoteAgent ? { ...field, type: 'iso-string' } : field));
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
    keepOtherFields: true,
    fields: dateTimeFields.map(field => ({
      fieldName: field.fieldName,
      columnName: null,
      dataType: 'datetime',
      fieldProcess: null,
      datetimeSettings: {
        inputType: field.type,
        ...toStringDateTimeSettings(field, ['inputTimezone', 'inputFormat', 'inputLocale']),
        outputType: 'string',
        // No output locale, as the old CSV export: the default one of the formatting
        outputTimezone: serialization?.outputTimezone ?? 'UTC',
        outputFormat: serialization?.outputTimestampFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS'
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

// The `time-values` data type is replaced by `record-list`: the point-based souths send point records
// (`{ pointId, timestamp, value, ...extras }`), and the standard transformers taking or producing time values are
// replaced by their record-list counterparts.
export const TIME_VALUES_TRANSFORMER_REPLACEMENTS: Record<string, { functionName: string; inputType: string; outputType: string }> = {
  'csv-to-time-values': { functionName: 'csv-to-record-list', inputType: 'any', outputType: 'record-list' },
  'time-values-to-csv': { functionName: RECORD_LIST_TO_CSV_FUNCTION_NAME, inputType: 'record-list', outputType: 'any' },
  'time-values-to-json': { functionName: 'record-list-to-json', inputType: 'record-list', outputType: 'any' },
  'time-values-to-modbus': { functionName: 'record-list-to-modbus', inputType: 'record-list', outputType: 'modbus' },
  'time-values-to-mqtt': { functionName: 'record-list-to-mqtt', inputType: 'record-list', outputType: 'mqtt' },
  'time-values-to-oianalytics': { functionName: 'record-list-to-oianalytics', inputType: 'record-list', outputType: 'oianalytics' },
  'time-values-to-opcua': { functionName: 'record-list-to-opcua', inputType: 'record-list', outputType: 'opcua' }
};

// The souths which sent time values: the OIAnalytics North sent them without transformer. It now only accepts files and
// OIAnalytics values, so their point records need a record-list-to-oianalytics transformer.
export const POINT_SOUTH_TYPES = ['ads', 'bacnet', 'modbus', 'opc', 'opcua', 'osisoft-pi', 's7'];
export const RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME = 'record-list-to-oianalytics';

/**
 * Groups the options of a record-list-to-oianalytics transformer by part of the OIAnalytics payload: the reference, the
 * timestamp and the value, each read from a field, the value now processed like the reference (without expression for
 * the existing transformers). Options already grouped are left as they are.
 */
export function toGroupedOIAnalyticsOptions(options: Record<string, unknown>): Record<string, unknown> {
  if (options.reference !== undefined) return options;
  const timestampSettings = (options.timestampSettings ?? {}) as Record<string, unknown>;
  const timestamp: Record<string, unknown> = {
    timestampField: options.timestampColumn ?? 'timestamp',
    sourceType: timestampSettings.type ?? 'iso-string',
    precision: options.precision ?? 'ms'
  };
  // The settings of the string timestamps, kept only when set: the form leaves them out for the other types
  for (const key of ['timezone', 'format', 'locale']) {
    if (timestampSettings[key] !== undefined) timestamp[key] = timestampSettings[key];
  }
  return {
    reference: { referenceField: options.pointIdColumn ?? 'pointId', referenceProcess: options.referenceProcess ?? null },
    timestamp,
    value: { valueField: options.valueColumn ?? 'value', valueProcess: null }
  };
}

/** The file transformers replacing the CSV and JSON ones: each reads both CSV and JSON files */
export const FILE_TRANSFORMER_REPLACEMENTS: Record<string, string> = {
  'csv-to-mqtt': 'file-to-mqtt',
  'csv-to-record-list': 'file-to-record-list',
  'json-to-oianalytics': 'file-to-oianalytics'
};

/**
 * Converts the options of a CSV or JSON transformer for the file transformer replacing it: how the file is read goes in
 * an `input` group, and the columns or JSONPaths become fields. csv-to-record-list sent point records: file-to-record-list
 * sends the rows with all their columns. Options already converted are returned as they are.
 */
export function toFileTransformerOptions(oldFunctionName: string, options: Record<string, unknown>): Record<string, unknown> {
  if (options.input !== undefined) return options;
  const csvInput = { fileType: 'csv', delimiter: options.delimiter ?? 'SEMI_COLON', hasHeader: options.hasHeader ?? true };
  switch (oldFunctionName) {
    case 'csv-to-mqtt': {
      const converted: Record<string, unknown> = {
        input: csvInput,
        topicField: options.topicColumn ?? 'topic',
        payloadType: options.payloadType ?? 'object',
        valueField: options.valueColumn ?? null
      };
      if (options.datetimeSettings !== undefined) converted.datetimeSettings = options.datetimeSettings;
      if (Array.isArray(options.objectFields)) {
        converted.objectFields = (options.objectFields as Array<Record<string, unknown>>).map(({ column, ...field }) => ({
          ...field,
          field: column
        }));
      }
      return converted;
    }
    case 'json-to-oianalytics': {
      const datetimeSettings = (options.datetimeSettings ?? {}) as Record<string, unknown>;
      const timestamp: Record<string, unknown> = {
        timestampField: options.timestamp ?? 'timestamp',
        sourceType: datetimeSettings.inputType ?? 'iso-string',
        precision: datetimeSettings.outputPrecision ?? 'ms'
      };
      for (const [key, oldKey] of [
        ['timezone', 'inputTimezone'],
        ['format', 'inputFormat'],
        ['locale', 'inputLocale']
      ]) {
        if (datetimeSettings[oldKey] !== undefined) timestamp[key] = datetimeSettings[oldKey];
      }
      return {
        input: { fileType: 'json', rowIteratorPath: options.rowIteratorPath ?? '$[*]' },
        reference: { referenceField: options.pointId ?? 'pointId', referenceProcess: options.referenceProcess ?? null },
        timestamp,
        value: { valueField: options.value ?? 'value', valueProcess: null }
      };
    }
    default:
      return { input: csvInput };
  }
}

/** The file transformers replacing the CSV and JSON writers: each writes both CSV and JSON files */
export const FILE_OUTPUT_TRANSFORMER_REPLACEMENTS: Record<string, string> = {
  'json-to-csv': 'file-to-file',
  'record-list-to-csv': 'record-list-to-file',
  'record-list-to-json': 'record-list-to-file'
};

/**
 * Converts the options of a CSV or JSON writer for the file transformer replacing it: the format of the written file
 * goes in an `output` group, and the fields are renamed `field` (the read field, or JSONPath) and `name` (the written
 * column). record-list-to-json sent the records as they are, in a JSON file. Options already converted are returned as
 * they are.
 */
export function toFileOutputTransformerOptions(oldFunctionName: string, options: Record<string, unknown>): Record<string, unknown> {
  if (options.output !== undefined) return options;
  if (oldFunctionName === 'record-list-to-json') {
    return {
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: '@CurrentDate.json',
      keepOtherFields: true,
      fields: []
    };
  }
  const fromJson = oldFunctionName === 'json-to-csv';
  const converted: Record<string, unknown> = {
    output: {
      fileType: 'csv',
      encoding: options.encoding ?? 'UTF_8',
      compression: options.compression ?? false,
      header: options.header ?? true,
      delimiter: options.delimiter ?? 'COMMA',
      newline: options.newline ?? 'LF',
      quoteChar: options.quoteChar ?? 'NONE',
      escapeChar: options.escapeChar ?? 'DOUBLE_QUOTE',
      nullValue: options.nullValue ?? ''
    },
    filename: options.filename ?? '@CurrentDate.csv',
    // json-to-csv only wrote its fields
    keepOtherFields: fromJson ? false : (options.keepOtherFields ?? true),
    fields: ((options.fields ?? []) as Array<Record<string, unknown>>).map(({ fieldName, jsonPath, columnName, ...field }) => ({
      ...field,
      field: fromJson ? jsonPath : fieldName,
      name: columnName ?? null
    }))
  };
  if (fromJson) {
    return { input: { fileType: 'json', rowIteratorPath: options.rowIteratorPath ?? '$[*]' }, ...converted };
  }
  return converted;
}

/** The data types the North File Writer no longer accepts: it only writes files */
export const FILE_WRITER_REMOVED_DATA_TYPES = ['record-list', 'setpoint'];

/**
 * The options of the file-to-file transformer replacing a file-to-record-list one on a North File Writer, which only
 * writes files: the rows of the file are written as they are in a JSON file, as the records were.
 */
export const toFileWriterFileToFileOptions = (options: Record<string, unknown>): Record<string, unknown> => ({
  input: options.input ?? { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true },
  output: { fileType: 'json', encoding: 'UTF_8', compression: false },
  filename: '@CurrentDate.json',
  keepOtherFields: true,
  fields: []
});

/**
 * The South OIAnalytics sends record lists (point records with their unit) instead of writing them in CSV files: the
 * `serialization` settings of its items become the options of a record-list-to-file transformer writing the same CSV
 * file (same columns, timestamp format, delimiter, name and compression).
 */
export function toOIAnalyticsItemFileOptions(serialization: Record<string, unknown>): Record<string, unknown> {
  const field = (name: string, extra: Record<string, unknown> = {}) => ({
    field: name,
    name: null,
    dataType: 'string',
    fieldProcess: null,
    ...extra
  });
  return {
    output: {
      fileType: 'csv',
      encoding: 'UTF_8',
      compression: serialization.compression ?? false,
      header: true,
      delimiter: serialization.delimiter ?? 'COMMA',
      newline: 'CRLF',
      quoteChar: 'NONE',
      escapeChar: 'DOUBLE_QUOTE',
      nullValue: ''
    },
    filename: serialization.filename ?? '@ConnectorName-@ItemName-@CurrentDate.csv',
    keepOtherFields: false,
    fields: [
      field('pointId'),
      field('timestamp', {
        dataType: 'datetime',
        datetimeSettings: {
          inputType: 'iso-string',
          outputType: 'string',
          outputTimezone: serialization.outputTimezone ?? 'UTC',
          outputFormat: serialization.outputTimestampFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS',
          outputLocale: 'en-En'
        }
      }),
      field('value'),
      field('unit')
    ]
  };
}

/** A transformer link of a South, as resolved for one of its items */
export interface SouthItemLink {
  groupId: unknown;
  itemIds: Array<unknown>;
  excludedItemIds: Array<unknown>;
}

/**
 * The link (in list order) routing the data of an item, as the North connectors do: the first link of the item, then
 * of its group, then of its whole South, a link leaving the item out being skipped.
 */
export function resolveSouthItemLink<T extends SouthItemLink>(links: Array<T>, itemId: unknown, groupId: unknown): T | undefined {
  const applies = (link: T) => !link.excludedItemIds.includes(itemId);
  return (
    links.find(link => link.itemIds.includes(itemId)) ??
    links.find(link => link.groupId && link.groupId === groupId && link.itemIds.length === 0 && applies(link)) ??
    links.find(link => !link.groupId && link.itemIds.length === 0 && applies(link))
  );
}

/** The South connectors which compressed their files themselves, now compressed by the North transformers */
export const COMPRESSING_SOUTH_TYPES = ['folder-scanner', 'ftp', 'sftp'];

/** The options of the file-to-file transformer replacing the file one: the file is sent as it is, with the same name */
export const FILE_AS_IS_OPTIONS = {
  input: { fileType: 'other' },
  filename: '@SourceFilename@SourceExtension',
  compression: false
};

/**
 * The options of the file-to-file transformer replacing the file one for the files of a South which compressed them:
 * the file is sent with the same name, gzipped (`.gz` being added to its name).
 */
export const COMPRESSED_FILE_OPTIONS = { ...FILE_AS_IS_OPTIONS, compression: true };

/** The 'file' transformer, sending the files as they are, is replaced by file-to-file (see `FILE_AS_IS_OPTIONS`) */
export const FILE_AS_IS_REPLACEMENT: Record<string, string> = { [FILE_PASSTHROUGH.functionName]: 'file-to-file' };

/** The North connectors which added a prefix and a suffix to the name of the files they sent, now added by their transformers */
export const PREFIXING_NORTH_TYPES = ['file-writer', 'sftp'];
/** The standard transformers naming the files they write (`filename` option) */
export const FILENAME_FUNCTION_NAMES = ['file-to-file', 'record-list-to-file'];

/**
 * The filename of a transformer sending files to a North which added a prefix and a suffix to their name: the prefix
 * before it, the suffix before its extension (`@SourceExtension`, or the extension written, e.g. `.csv`). The
 * `@ConnectorName` of the prefix and suffix was the name of the North: it is replaced by it, being the name of the South
 * in a transformer.
 */
export function withPrefixAndSuffix(filename: string, prefix: string, suffix: string, northName: string): string {
  const resolve = (value: string) => value.replaceAll('@ConnectorName', northName);
  const extension = filename.endsWith('@SourceExtension') ? '@SourceExtension' : path.extname(filename);
  return `${resolve(prefix)}${filename.slice(0, filename.length - extension.length)}${resolve(suffix)}${extension}`;
}

/** The default of the OPC UA connection, read and write timeouts, in ms */
const OPCUA_DEFAULT_TIMEOUT = 15_000;

/**
 * The OPC UA South settings gain a connection timeout and a `subscription` group: the number of messages before a flush
 * and the delay between flushes (`maxNumberOfMessages` and `flushMessageTimeout`) move into it, next to the publishing
 * interval and keep alive count of the OPC UA subscription, which were fixed
 * until now.
 */
export function toOPCUASouthSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const { maxNumberOfMessages, flushMessageTimeout, ...rest } = settings;
  return {
    ...rest,
    connectionTimeout: rest.connectionTimeout ?? OPCUA_DEFAULT_TIMEOUT,
    subscription: rest.subscription ?? {
      publishingInterval: 150,
      maxKeepAliveCount: 10,
      numberOfMessageBeforeFlush: maxNumberOfMessages ?? 1000,
      delayBetweenFlush: flushMessageTimeout ?? 1000
    }
  };
}

/** The OPC UA North settings gain a connection timeout and a write timeout (until now the node-opcua defaults) */
export function toOPCUANorthSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return {
    ...settings,
    connectionTimeout: settings.connectionTimeout ?? OPCUA_DEFAULT_TIMEOUT,
    writeTimeout: settings.writeTimeout ?? OPCUA_DEFAULT_TIMEOUT
  };
}

/** The database souths whose work-units can now query in parallel, gaining a `maxParallelRun` setting */
export const MAX_PARALLEL_RUN_SOUTH_TYPES = ['influxdb', 'mssql', 'mysql', 'odbc', 'oracle', 'postgresql'];

/** The settings of the database souths moved into their `connectionSettings` group */
const CONNECTION_SETTINGS_KEYS: Record<string, Array<string>> = {
  influxdb: ['version', 'host', 'port', 'protocol', 'database', 'username', 'password', 'url', 'token', 'organisation', 'bucket'],
  mssql: ['host', 'port', 'connectionTimeout', 'database', 'encryption', 'trustServerCertificate', 'username', 'password', 'domain'],
  mysql: ['host', 'port', 'connectionTimeout', 'database', 'username', 'password'],
  oracle: ['thickMode', 'oracleClient', 'host', 'port', 'connectionTimeout', 'database', 'username', 'password'],
  postgresql: ['host', 'port', 'sslMode', 'database', 'connectionTimeout', 'username', 'password']
};

/** The default time an unused connection of the pool of the SQL souths stays open, in ms */
const POOL_IDLE_TIMEOUT = 30_000;

/** The database souths whose request timeout moves from the connector to the items */
export const ITEM_REQUEST_TIMEOUT_SOUTH_TYPES = ['mssql', 'postgresql'];

/** The request timeout of the connectors missing one, in ms */
const DEFAULT_REQUEST_TIMEOUT = 15_000;

/** The item settings gain the request timeout of their connector settings (see `ITEM_REQUEST_TIMEOUT_SOUTH_TYPES`) */
export function withItemRequestTimeout(
  itemSettings: Record<string, unknown>,
  connectorSettings: Record<string, unknown>
): Record<string, unknown> {
  return { ...itemSettings, requestTimeout: itemSettings.requestTimeout ?? connectorSettings.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT };
}

/**
 * The database South settings gain a `maxParallelRun`, 1 keeping the queries sequential as until now. Their connection
 * settings move into a `connectionSettings` group, with the idle timeout of the connection pool of the SQL souths.
 */
export function toDatabaseSouthSettings(southType: string, settings: Record<string, unknown>): Record<string, unknown> {
  const keys = CONNECTION_SETTINGS_KEYS[southType];
  if (!keys) {
    return { ...settings, maxParallelRun: settings.maxParallelRun ?? 1 };
  }
  const rest = { ...settings };
  if (ITEM_REQUEST_TIMEOUT_SOUTH_TYPES.includes(southType)) {
    // Moved to the items (see withItemRequestTimeout)
    delete rest.requestTimeout;
  }
  const connectionSettings: Record<string, unknown> = { ...((rest.connectionSettings as Record<string, unknown> | undefined) ?? {}) };
  for (const key of keys) {
    if (key in rest) {
      connectionSettings[key] = rest[key];
      delete rest[key];
    }
  }
  if (southType !== 'influxdb') {
    connectionSettings.idleTimeout ??= POOL_IDLE_TIMEOUT;
  }
  return { ...rest, connectionSettings, maxParallelRun: rest.maxParallelRun ?? 1 };
}

/**
 * The setpoints sent by OIAnalytics are records (`{ reference, value }`): the setpoint transformers are replaced by the
 * record-list ones.
 */
export const SETPOINT_TRANSFORMER_REPLACEMENTS: Record<string, string> = {
  'setpoint-to-json': 'record-list-to-file',
  'setpoint-to-modbus': 'record-list-to-modbus',
  'setpoint-to-mqtt': 'record-list-to-mqtt',
  'setpoint-to-opcua': 'record-list-to-opcua'
};

/**
 * Converts the options of a setpoint transformer for the record-list one replacing it: the point of a setpoint is read
 * from its `reference`, and its value from its `value`. setpoint-to-json sent the setpoints as they are, in a JSON file;
 * setpoint-to-mqtt published the value alone. Options already converted are returned as they are.
 */
export function toSetpointTransformerOptions(oldFunctionName: string, options: Record<string, unknown>): Record<string, unknown> {
  if (oldFunctionName === 'setpoint-to-json') {
    if (options.output !== undefined) return options;
    return {
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: '@CurrentDate.json',
      keepOtherFields: true,
      fields: []
    };
  }
  if (options.pointIdColumn !== undefined) return options;
  const mapping = ((options.mapping ?? []) as Array<Record<string, unknown>>).map(({ reference, ...target }) => ({
    pointId: reference,
    ...target
  }));
  if (oldFunctionName === 'setpoint-to-mqtt') {
    return { pointIdColumn: 'reference', payload: 'value', valueColumn: 'value', mapping };
  }
  return { pointIdColumn: 'reference', valueColumn: 'value', mapping };
}

/** The data type of a transformer input or output, `setpoint` becoming `record-list`. */
export const toSetpointFreeDataType = (dataType: string): string => (dataType === 'setpoint' ? 'record-list' : dataType);

/** The data type of a transformer input or output, `any` being renamed `file`. */
export const toFileDataType = (dataType: string): string => (dataType === 'any' ? 'file' : dataType);

/** The data type of a custom transformer input or output, `time-values` becoming `record-list`. */
export const toRecordListDataType = (dataType: string): string => (dataType === 'time-values' ? 'record-list' : dataType);

/**
 * Converts the options of a replaced time-values transformer for its record-list replacement, reading the columns of
 * the point records. `time-values-to-csv` becomes a `record-list-to-csv` writing the same three columns.
 */
export function toRecordListTransformerOptions(oldFunctionName: string, options: Record<string, unknown>): Record<string, unknown> {
  switch (oldFunctionName) {
    case 'time-values-to-csv':
      return {
        filename: options.filename ?? '@CurrentDate.csv',
        encoding: options.encoding ?? 'UTF_8',
        header: options.header ?? true,
        compression: false,
        delimiter: options.delimiter ?? 'COMMA',
        newline: options.newline ?? 'LF',
        quoteChar: options.quoteChar ?? 'NONE',
        escapeChar: options.escapeChar ?? 'DOUBLE_QUOTE',
        nullValue: '',
        keepOtherFields: false,
        fields: [
          {
            fieldName: 'pointId',
            columnName: options.pointIdColumnTitle ?? 'Reference',
            dataType: 'string',
            fieldProcess: options.pointIdProcess ?? null,
            datetimeSettings: null
          },
          {
            fieldName: 'timestamp',
            columnName: options.timestampColumnTitle ?? 'Timestamp',
            dataType: 'datetime',
            fieldProcess: null,
            datetimeSettings: {
              inputType: 'iso-string',
              inputTimezone: null,
              inputFormat: null,
              inputLocale: null,
              outputType: options.timestampType ?? 'iso-string',
              outputTimezone: options.timezone ?? 'UTC',
              outputFormat: options.timestampFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS',
              outputLocale: null
            }
          },
          {
            fieldName: 'value',
            columnName: options.valueColumnTitle ?? 'Value',
            dataType: 'string',
            fieldProcess: null,
            datetimeSettings: null
          }
        ]
      };
    case 'time-values-to-oianalytics':
      return {
        pointIdColumn: 'pointId',
        timestampColumn: 'timestamp',
        valueColumn: 'value',
        timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-En' },
        precision: options.precision ?? 'ms',
        referenceProcess: options.referenceProcess ?? null
      };
    case 'time-values-to-mqtt':
      return { pointIdColumn: 'pointId', ...options };
    case 'time-values-to-modbus':
    case 'time-values-to-opcua':
      return { pointIdColumn: 'pointId', valueColumn: 'value', ...options };
    default:
      return options;
  }
}

/** The options of a record-list-to-oianalytics transformer sending point records as they used to be sent. */
export const defaultRecordListToOIAnalyticsOptions = (): Record<string, unknown> =>
  toRecordListTransformerOptions('time-values-to-oianalytics', {});

// The south types whose item manifest defaulted the resampling to 'raw', which is not one of its selectable values
// ('none', '1s', ...). 'raw' already meant no resampling at runtime.
export const RAW_RESAMPLING_SOUTH_TYPES = ['opcua', 'opc'];

/**
 * Returns the settings of an OPC UA (`haMode.resampling`) or OPC (`resampling`) item with a 'raw' resampling moved to
 * 'none', or null when there is nothing to change.
 */
export function toNoneResamplingItemSettings(southType: string, settings: JsonObject): JsonObject | null {
  if (southType === 'opcua') {
    const haMode = settings.haMode as JsonObject | null | undefined;
    if (haMode?.resampling !== 'raw') return null;
    return { ...settings, haMode: { ...haMode, resampling: 'none' } };
  }
  if (southType === 'opc' && settings.resampling === 'raw') {
    return { ...settings, resampling: 'none' };
  }
  return null;
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
      // record-list-to-csv is replaced by record-list-to-file at the end of the upgrade, with its manifest
      manifest: null
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

    const viaRemoteAgent = usesRemoteAgent(south.type as string, (south.settings as JsonObject).settings as JsonObject);
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
            options: buildRecordListToCsvOptions(oldSettings, viaRemoteAgent),
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

    const viaRemoteAgent = usesRemoteAgent(settings.southType as string, settings.southSettings as JsonObject);
    for (const item of items) {
      const oldSettings = item.settings as OldSqlItemSettings;
      const resolved = itemLevel.get(item.id) ?? historyLevel;
      if (!keepsResolvedTransformer(resolved ? catalog.functionName(resolved.transformerId) : undefined)) {
        settings.northTransformers = [
          ...asObjects(settings.northTransformers),
          {
            id: generateRandomId(6),
            transformerId: catalog.recordListToCsvId(),
            options: buildRecordListToCsvOptions(oldSettings, viaRemoteAgent),
            items: [itemLight(item)]
          }
        ];
      }
      item.settings = toNewSqlItemSettings(oldSettings);
    }
  });
}

// csv-to-time-values becomes csv-to-record-list, itself replaced by file-to-record-list (see `FILE_TRANSFORMER_REPLACEMENTS`)
const RECORD_LIST_TRANSFORMER_MANIFESTS = [
  recordListToModbusManifest,
  recordListToMqttManifest,
  recordListToOianalyticsManifest,
  recordListToOpcuaManifest
];

/**
 * Replaces the time-values standard transformers by their record-list counterparts (renamed, or merged into the
 * replacement the configuration already describes), converting the options of their links, and converts the data
 * types of the custom transformers. The existing record-list-to-csv links keep every field.
 * Returns whether the configuration still described time-values transformers (an export carries every standard
 * transformer, so this tells an export made before the record-list refactor).
 */
function migrateTimeValuesTransformers(config: JsonObject): boolean {
  const transformers = asObjects(config.transformers);
  const replacedIds = new Map<unknown, { oldFunctionName: string; newId: unknown }>();
  const keptTransformers: Array<JsonObject> = [];
  for (const transformer of transformers) {
    const settings = transformer.settings as JsonObject;
    if (transformer.type !== 'standard') {
      settings.inputType = toRecordListDataType(settings.inputType as string);
      settings.outputType = toRecordListDataType(settings.outputType as string);
      keptTransformers.push(transformer);
      continue;
    }
    const oldFunctionName = settings.functionName as string;
    const replacement = TIME_VALUES_TRANSFORMER_REPLACEMENTS[oldFunctionName];
    if (!replacement) {
      keptTransformers.push(transformer);
      continue;
    }
    const existingReplacement = transformers.find(
      candidate => candidate.type === 'standard' && (candidate.settings as JsonObject).functionName === replacement.functionName
    );
    if (existingReplacement) {
      replacedIds.set(transformer.oIBusInternalId, { oldFunctionName, newId: existingReplacement.oIBusInternalId });
      continue;
    }
    transformer.settings = { ...replacement };
    transformer.manifest = RECORD_LIST_TRANSFORMER_MANIFESTS.find(manifest => manifest.id === replacement.functionName)?.settings ?? null;
    replacedIds.set(transformer.oIBusInternalId, { oldFunctionName, newId: transformer.oIBusInternalId });
    keptTransformers.push(transformer);
  }
  config.transformers = keptTransformers;

  const recordListToCsvId = keptTransformers.find(
    transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === RECORD_LIST_TO_CSV_FUNCTION_NAME
  )?.oIBusInternalId;
  const convertLink = (link: JsonObject): void => {
    const replaced = replacedIds.get(link.transformerId);
    if (replaced) {
      link.transformerId = replaced.newId;
      link.options = toRecordListTransformerOptions(replaced.oldFunctionName, (link.options as JsonObject | null) ?? {});
    }
    if (recordListToCsvId !== undefined && link.transformerId === recordListToCsvId) {
      link.options = { ...((link.options as JsonObject | null) ?? {}) };
      setMissing(link.options as JsonObject, 'keepOtherFields', true);
    }
  };
  forEachNorth(config, null, north => asObjects((north.settings as JsonObject).transformers).forEach(convertLink));
  forEachHistoryQuery(config, null, settings => asObjects(settings.northTransformers).forEach(convertLink));
  return replacedIds.size > 0;
}

/**
 * The OIAnalytics North no longer accepts time values: the point-based souths (and history queries) sending to an
 * OIAnalytics North go through a record-list-to-oianalytics transformer, replacing their 'iso' links and added at
 * the south (or history query) level when there is none (see `replaceTimeValuesByRecordLists` in the entity
 * migration). Only applied to an export made before the record-list refactor: afterwards, a point-based south
 * without transformer deliberately sends nothing to the OIAnalytics North.
 */
function addOIAnalyticsTransformers(config: JsonObject): void {
  const pointSouthIds = asObjects(config.southConnectors)
    .filter(south => POINT_SOUTH_TYPES.includes(south.type as string))
    .map(south => south.oIBusInternalId);
  const oiaNorths = asObjects(config.northConnectors).filter(north => north.type === 'oianalytics');
  const oiaHistoryQueries = asObjects(config.historyQueries)
    .map(historyQuery => historyQuery.settings as JsonObject)
    .filter(settings => settings.northType === 'oianalytics' && POINT_SOUTH_TYPES.includes(settings.southType as string));
  if ((oiaNorths.length === 0 || pointSouthIds.length === 0) && oiaHistoryQueries.length === 0) return;

  const transformers = asObjects(config.transformers);
  const standardId = (functionName: string) =>
    transformers.find(transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === functionName)
      ?.oIBusInternalId;
  let oiaTransformerId = standardId(RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME);
  if (oiaTransformerId === undefined) {
    oiaTransformerId = generateRandomId(6);
    transformers.push({
      oIBusInternalId: oiaTransformerId,
      type: 'standard',
      settings: { functionName: RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME, inputType: 'record-list', outputType: 'oianalytics' },
      manifest: recordListToOianalyticsManifest.settings
    });
    config.transformers = transformers;
  }
  const isoId = standardId('iso');
  const replaceIso = (link: JsonObject): void => {
    if (isoId === undefined || link.transformerId !== isoId) return;
    link.transformerId = oiaTransformerId;
    link.options = defaultRecordListToOIAnalyticsOptions();
  };

  for (const north of oiaNorths) {
    const settings = north.settings as JsonObject;
    const links = asObjects(settings.transformers);
    for (const southId of pointSouthIds) {
      const southLinks = links.filter(link => {
        const source = link.source as JsonObject;
        return source.type === 'south' && source.southId === southId;
      });
      southLinks.forEach(replaceIso);
      const hasSouthLevelLink = southLinks.some(link => {
        const source = link.source as JsonObject;
        return !source.groupId && asObjects(source.items).length === 0;
      });
      if (!hasSouthLevelLink) {
        links.push({
          id: generateRandomId(6),
          transformerId: oiaTransformerId,
          options: defaultRecordListToOIAnalyticsOptions(),
          source: { type: 'south', southId, items: [] }
        });
      }
    }
    settings.transformers = links;
  }
  for (const settings of oiaHistoryQueries) {
    const links = asObjects(settings.northTransformers);
    links.forEach(replaceIso);
    if (!links.some(link => asObjects(link.items).length === 0)) {
      links.push({ id: generateRandomId(6), transformerId: oiaTransformerId, options: defaultRecordListToOIAnalyticsOptions(), items: [] });
    }
    settings.northTransformers = links;
  }
}

/**
 * The 'iso' and 'ignore' standard transformers are removed: the links are changed to keep routing the data as before
 * (see `replaceIsoAndIgnoreTransformers` in the entity migration). Only applied to an export describing them (an
 * export carries every standard transformer): afterwards, the data without transformer is deliberately dropped.
 */
function replaceIsoAndIgnoreTransformers(config: JsonObject): void {
  const transformers = asObjects(config.transformers);
  const functionNameOf = (transformerId: unknown): string | undefined => {
    const transformer = transformers.find(candidate => candidate.oIBusInternalId === transformerId);
    return transformer?.type === 'standard' ? ((transformer.settings as JsonObject).functionName as string) : undefined;
  };
  const isRemoved = (transformer: JsonObject) =>
    transformer.type === 'standard' &&
    [ISO_FUNCTION_NAME, IGNORE_FUNCTION_NAME].includes((transformer.settings as JsonObject).functionName as string);
  const removedIds = transformers.filter(isRemoved).map(transformer => transformer.oIBusInternalId);
  if (removedIds.length === 0) return;

  const passthroughId = (passthrough: Passthrough): unknown => {
    const existing = transformers.find(
      transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === passthrough.functionName
    );
    if (existing) return existing.oIBusInternalId;
    const id = generateRandomId(6);
    transformers.push({
      oIBusInternalId: id,
      type: 'standard',
      settings: { ...passthrough },
      // the passthroughs are replaced by file-to-file and record-list-to-file at the end of the upgrade, with their manifest
      manifest: null
    });
    return id;
  };
  const toPassthrough = (link: JsonObject, passthrough: Passthrough): void => {
    link.transformerId = passthroughId(passthrough);
    link.options = {};
  };
  const routingLink = (link: JsonObject, itemIds: Array<unknown>, groupItemIds?: Array<unknown>) => ({
    id: link.id as string,
    functionName: functionNameOf(link.transformerId),
    itemIds: itemIds as Array<string>,
    groupItemIds: groupItemIds as Array<string> | undefined
  });
  /** Applies a plan to the links of a source, returning the links of the North (or history query) left */
  const applyPlan = (
    links: Array<JsonObject>,
    plan: RoutingPlan,
    isoPassthrough: Passthrough | undefined,
    narrow: (link: JsonObject, itemIds: Array<string>) => void
  ): Array<JsonObject> => {
    for (const link of links) {
      if (plan.toPassthrough.includes(link.id as string)) toPassthrough(link, isoPassthrough!);
      const narrowedItemIds = plan.narrowed.get(link.id as string);
      if (narrowedItemIds) narrow(link, narrowedItemIds);
    }
    return links.filter(link => !plan.removed.includes(link.id as string));
  };
  const sourceOf = (link: JsonObject) => link.source as JsonObject;

  const souths = asObjects(config.southConnectors);
  forEachNorth(config, null, north => {
    const settings = north.settings as JsonObject;
    const northType = north.type as string;
    let links = asObjects(settings.transformers);

    for (const south of souths) {
      const items = asObjects((south.settings as JsonObject).items);
      const southLinks = links.filter(link => sourceOf(link).type === 'south' && sourceOf(link).southId === south.oIBusInternalId);
      const contentType = southContentType(south.type as string);
      const defaultPassthrough = passthroughFor(contentType, northType, false);
      const isoPassthrough = passthroughFor(contentType, northType, true);
      const plan = planRouting(
        southLinks.map(link => {
          const source = sourceOf(link);
          return routingLink(
            link,
            asObjects(source.items).map(item => item.id),
            source.groupId ? items.filter(item => item.groupId === source.groupId).map(item => item.id) : undefined
          );
        }),
        items.map(item => item.id as string),
        defaultPassthrough !== undefined,
        isoPassthrough !== undefined,
        true
      );
      const itemsOf = (itemIds: Array<string>) => items.filter(item => itemIds.includes(item.id as string)).map(itemLight);
      // Only the links listing items are narrowed: they keep listing some of them
      links = applyPlan(links, plan, isoPassthrough, (link, itemIds) => {
        link.source = { ...sourceOf(link), items: itemsOf(itemIds) };
      });
      for (const link of links) {
        const excludedItemIds = plan.excluded.get(link.id as string);
        if (excludedItemIds) link.source = { ...sourceOf(link), excludedItems: itemsOf(excludedItemIds) };
      }
      if (plan.added) {
        const source: JsonObject = { type: 'south', southId: south.oIBusInternalId, items: itemsOf(plan.added.itemIds) };
        if (plan.added.excludedItemIds.length > 0) source.excludedItems = itemsOf(plan.added.excludedItemIds);
        links.push({ id: generateRandomId(6), transformerId: passthroughId(defaultPassthrough!), source, options: {} });
      }
    }

    // OIBus API: each data source is routed by its first link, the others by a new link applying to every data source
    const filePassthrough = passthroughFor('any', northType, true);
    const dataSourceIds = new Set(links.filter(link => sourceOf(link).type === 'oibus-api').map(link => sourceOf(link).dataSourceId));
    let ignoresDataSources = false;
    for (const dataSourceId of dataSourceIds) {
      const dataSourceLinks = links.filter(link => sourceOf(link).type === 'oibus-api' && sourceOf(link).dataSourceId === dataSourceId);
      const plan = planSourceRouting(
        dataSourceLinks.map(link => routingLink(link, [])),
        filePassthrough !== undefined
      );
      ignoresDataSources ||= plan.ignored;
      dataSourceLinks.filter(link => link.id === plan.toPassthrough).forEach(link => toPassthrough(link, FILE_PASSTHROUGH));
      links = links.filter(link => !plan.removed.includes(link.id as string));
    }
    if (filePassthrough && !ignoresDataSources) {
      links.push({ id: generateRandomId(6), transformerId: passthroughId(FILE_PASSTHROUGH), source: { type: 'oibus-api' }, options: {} });
    }

    // OIAnalytics setpoints
    const setpointLinks = links.filter(link => sourceOf(link).type === 'oianalytics-setpoint');
    const setpointPassthrough = passthroughFor('setpoint', northType, true);
    const setpointPlan = planSourceRouting(
      setpointLinks.map(link => routingLink(link, [])),
      setpointPassthrough !== undefined
    );
    setpointLinks.filter(link => link.id === setpointPlan.toPassthrough).forEach(link => toPassthrough(link, SETPOINT_PASSTHROUGH));
    links = links.filter(link => !setpointPlan.removed.includes(link.id as string));
    if (setpointLinks.length === 0 && setpointPassthrough) {
      links.push({
        id: generateRandomId(6),
        transformerId: passthroughId(SETPOINT_PASSTHROUGH),
        source: { type: 'oianalytics-setpoint' },
        options: {}
      });
    }

    // The links left to 'iso' and 'ignore' were never used (e.g. their south was deleted)
    settings.transformers = links.filter(link => !removedIds.includes(link.transformerId));
  });

  forEachHistoryQuery(config, null, settings => {
    const items = asObjects(settings.items);
    const links = asObjects(settings.northTransformers);
    const contentType = southContentType(settings.southType as string);
    const defaultPassthrough = passthroughFor(contentType, settings.northType as string, false);
    const isoPassthrough = passthroughFor(contentType, settings.northType as string, true);
    const plan = planRouting(
      links.map(link =>
        routingLink(
          link,
          asObjects(link.items).map(item => item.id)
        )
      ),
      items.map(item => item.id as string),
      defaultPassthrough !== undefined,
      isoPassthrough !== undefined,
      false
    );
    const newLinks = applyPlan(links, plan, isoPassthrough, (link, itemIds) => {
      link.items = items.filter(item => itemIds.includes(item.id as string)).map(itemLight);
    });
    if (plan.added) {
      newLinks.push({
        id: generateRandomId(6),
        transformerId: passthroughId(defaultPassthrough!),
        options: {},
        items: items.filter(item => plan.added!.itemIds.includes(item.id as string)).map(itemLight)
      });
    }
    settings.northTransformers = newLinks.filter(link => !removedIds.includes(link.transformerId));
  });

  config.transformers = transformers.filter(transformer => !isRemoved(transformer));
}

const REPLACEMENT_TRANSFORMER_MANIFESTS = [
  fileToFileManifest,
  fileToMqttManifest,
  fileToOianalyticsManifest,
  fileToRecordListManifest,
  recordListToFileManifest,
  recordListToModbusManifest,
  recordListToMqttManifest,
  recordListToOpcuaManifest
];

/**
 * Standard transformers are replaced (see `FILE_TRANSFORMER_REPLACEMENTS`, `FILE_OUTPUT_TRANSFORMER_REPLACEMENTS` and
 * `SETPOINT_TRANSFORMER_REPLACEMENTS`): renamed in place, or merged into their replacement when the configuration
 * already describes it, their links' options being converted.
 */
function replaceCsvAndJsonTransformers(
  config: JsonObject,
  replacements: Record<string, string>,
  convertOptions: (oldFunctionName: string, options: Record<string, unknown>) => Record<string, unknown>
): void {
  // In the order of the replacements, as the migrations do: the first replaced transformer is renamed in place
  const replacedIds = new Map<unknown, { oldFunctionName: string; newId: unknown }>();
  for (const [oldFunctionName, newFunctionName] of Object.entries(replacements)) {
    const transformers = asObjects(config.transformers);
    const isStandard = (transformer: JsonObject, functionName: string) =>
      transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === functionName;
    const oldTransformer = transformers.find(transformer => isStandard(transformer, oldFunctionName));
    if (!oldTransformer) continue;
    const existingReplacement = transformers.find(transformer => isStandard(transformer, newFunctionName));
    if (existingReplacement) {
      replacedIds.set(oldTransformer.oIBusInternalId, { oldFunctionName, newId: existingReplacement.oIBusInternalId });
      config.transformers = transformers.filter(transformer => transformer !== oldTransformer);
      continue;
    }
    (oldTransformer.settings as JsonObject).functionName = newFunctionName;
    oldTransformer.manifest = REPLACEMENT_TRANSFORMER_MANIFESTS.find(manifest => manifest.id === newFunctionName)!.settings;
    replacedIds.set(oldTransformer.oIBusInternalId, { oldFunctionName, newId: oldTransformer.oIBusInternalId });
  }

  const convertLink = (link: JsonObject): void => {
    const replaced = replacedIds.get(link.transformerId);
    if (!replaced) return;
    link.transformerId = replaced.newId;
    link.options = convertOptions(replaced.oldFunctionName, (link.options as JsonObject | null) ?? {});
  };
  forEachNorth(config, null, north => asObjects((north.settings as JsonObject).transformers).forEach(convertLink));
  forEachHistoryQuery(config, null, settings => asObjects(settings.northTransformers).forEach(convertLink));
}

/**
 * The North File Writer only writes files: its file-to-record-list links write the rows of the file in a JSON file
 * through file-to-file instead (see `toFileWriterFileToFileOptions`), and its links to the custom transformers sending
 * records or setpoints are removed.
 */
function convertFileWriterLinks(config: JsonObject): void {
  const transformers = asObjects(config.transformers);
  const transformerOf = (id: unknown) => transformers.find(transformer => transformer.oIBusInternalId === id);
  const fileToFileId = (): unknown => {
    const existing = transformers.find(
      transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === fileToFileManifest.id
    );
    if (existing) return existing.oIBusInternalId;
    const added = {
      oIBusInternalId: generateRandomId(6),
      type: 'standard',
      settings: { functionName: fileToFileManifest.id, inputType: 'file', outputType: 'file' },
      manifest: fileToFileManifest.settings
    };
    transformers.push(added);
    config.transformers = transformers;
    return added.oIBusInternalId;
  };
  const convertLinks = (links: Array<JsonObject>): Array<JsonObject> =>
    links.flatMap(link => {
      const transformer = transformerOf(link.transformerId);
      const settings = (transformer?.settings ?? {}) as JsonObject;
      if (!FILE_WRITER_REMOVED_DATA_TYPES.includes(settings.outputType as string)) return [link];
      if (transformer!.type !== 'standard' || settings.functionName !== fileToRecordListManifest.id) return [];
      return [
        { ...link, transformerId: fileToFileId(), options: toFileWriterFileToFileOptions((link.options as JsonObject | null) ?? {}) }
      ];
    });
  forEachNorth(config, 'file-writer', north => {
    const settings = north.settings as JsonObject;
    settings.transformers = convertLinks(asObjects(settings.transformers));
  });
  forEachHistoryQuery(config, null, settings => {
    if (settings.northType !== 'file-writer') return;
    settings.northTransformers = convertLinks(asObjects(settings.northTransformers));
  });
}

/**
 * The South OIAnalytics sends record lists instead of CSV files: for each of its items sent as is (through the file
 * transformer) to a North or by a history query, a record-list-to-file transformer writes the same CSV file (see
 * `toOIAnalyticsItemFileOptions`). Its links to the transformers reading files are removed, and its items lose their
 * `serialization` settings.
 */
function convertOIAnalyticsSouths(config: JsonObject): void {
  const transformers = asObjects(config.transformers);
  const transformerOf = (id: unknown) => transformers.find(transformer => transformer.oIBusInternalId === id);
  const readsFiles = (link: JsonObject) => (transformerOf(link.transformerId)?.settings as JsonObject | undefined)?.inputType === 'file';
  const sendsAsIs = (link: JsonObject | undefined) => {
    const transformer = link ? transformerOf(link.transformerId) : undefined;
    return transformer?.type === 'standard' && (transformer.settings as JsonObject).functionName === FILE_PASSTHROUGH.functionName;
  };
  const recordListToFileId = (): unknown => {
    const existing = transformers.find(
      transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === recordListToFileManifest.id
    );
    if (existing) return existing.oIBusInternalId;
    const added = {
      oIBusInternalId: generateRandomId(6),
      type: 'standard',
      settings: { functionName: recordListToFileManifest.id, inputType: 'record-list', outputType: 'file' },
      manifest: recordListToFileManifest.settings
    };
    transformers.push(added);
    config.transformers = transformers;
    return added.oIBusInternalId;
  };
  const serializationOf = (item: JsonObject) => (item.settings as JsonObject).serialization as JsonObject | undefined;
  const removeSerialization = (item: JsonObject) => {
    const { serialization: _serialization, ...settings } = item.settings as JsonObject;
    item.settings = settings;
  };

  forEachSouth(config, 'oianalytics', south => {
    const items = asObjects((south.settings as JsonObject).items).filter(item => serializationOf(item) !== undefined);
    if (items.length === 0) return;
    forEachNorth(config, null, north => {
      const settings = north.settings as JsonObject;
      const allLinks = asObjects(settings.transformers);
      const southLinks = allLinks
        .filter(
          link => (link.source as JsonObject | undefined)?.type === 'south' && (link.source as JsonObject).southId === south.oIBusInternalId
        )
        .map(link => {
          const source = link.source as JsonObject;
          return {
            link,
            groupId: source.groupId ?? null,
            itemIds: asObjects(source.items).map(item => item.id),
            excludedItemIds: asObjects(source.excludedItems).map(item => item.id)
          };
        });
      if (southLinks.length === 0) return;
      const added = items
        .filter(item => sendsAsIs(resolveSouthItemLink(southLinks, item.id, item.groupId)?.link))
        .map(item => ({
          id: generateRandomId(6),
          transformerId: recordListToFileId(),
          options: toOIAnalyticsItemFileOptions(serializationOf(item)!),
          source: { type: 'south', southId: south.oIBusInternalId, items: [itemLight(item)] }
        }));
      const removed = new Set(southLinks.filter(({ link }) => readsFiles(link)).map(({ link }) => link));
      settings.transformers = [...allLinks.filter(link => !removed.has(link)), ...added];
    });
    items.forEach(removeSerialization);
  });

  forEachHistoryQuery(config, 'oianalytics', settings => {
    const items = asObjects(settings.items).filter(item => serializationOf(item) !== undefined);
    if (items.length === 0) return;
    const links = asObjects(settings.northTransformers);
    const historyLinks = links.map(link => ({
      link,
      groupId: null,
      itemIds: asObjects(link.items).map(item => item.id),
      excludedItemIds: []
    }));
    const added = items
      .filter(item => sendsAsIs(resolveSouthItemLink(historyLinks, item.id, null)?.link))
      .map(item => ({
        id: generateRandomId(6),
        transformerId: recordListToFileId(),
        options: toOIAnalyticsItemFileOptions(serializationOf(item)!),
        items: [itemLight(item)]
      }));
    settings.northTransformers = [...links.filter(link => !readsFiles(link)), ...added];
    items.forEach(removeSerialization);
  });
}

/**
 * The folder scanner, FTP and SFTP South connectors no longer compress their files: when they did, their files sent as
 * they are (through the file transformer) are compressed by a file-to-file transformer instead (see
 * `COMPRESSED_FILE_OPTIONS`). The `compression` setting is removed.
 */
function moveCompressionToNorths(config: JsonObject): void {
  const transformers = asObjects(config.transformers);
  const fileId = transformers.find(
    transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === FILE_PASSTHROUGH.functionName
  )?.oIBusInternalId;
  const fileToFileId = (): unknown => {
    const existing = transformers.find(
      transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === fileToFileManifest.id
    );
    if (existing) return existing.oIBusInternalId;
    const added = {
      oIBusInternalId: generateRandomId(6),
      type: 'standard',
      settings: { functionName: fileToFileManifest.id, inputType: 'file', outputType: 'file' },
      manifest: fileToFileManifest.settings
    };
    transformers.push(added);
    config.transformers = transformers;
    return added.oIBusInternalId;
  };
  const compress = (link: JsonObject): void => {
    if (fileId === undefined || link.transformerId !== fileId) return;
    link.transformerId = fileToFileId();
    link.options = structuredClone(COMPRESSED_FILE_OPTIONS);
  };
  /** Removes the compression setting of a South, returning whether it was compressing its files */
  const removeCompression = (owner: JsonObject, key: string): boolean => {
    const settings = owner[key] as JsonObject | undefined;
    if (settings?.compression === undefined) return false;
    const { compression, ...rest } = settings;
    owner[key] = rest;
    return compression === true;
  };

  for (const southType of COMPRESSING_SOUTH_TYPES) {
    forEachSouth(config, southType, south => {
      if (!removeCompression(south.settings as JsonObject, 'settings')) return;
      forEachNorth(config, null, north =>
        asObjects((north.settings as JsonObject).transformers)
          .filter(
            link =>
              (link.source as JsonObject | undefined)?.type === 'south' && (link.source as JsonObject).southId === south.oIBusInternalId
          )
          .forEach(compress)
      );
    });
    forEachHistoryQuery(config, southType, settings => {
      if (removeCompression(settings, 'southSettings')) asObjects(settings.northTransformers).forEach(compress);
    });
  }
}

/**
 * The setpoints sent by OIAnalytics are records: the setpoint transformers are replaced by the record-list ones (see
 * `toSetpointTransformerOptions`), and the custom transformers reading or writing setpoints read or write records. The
 * record-list-to-mqtt links without payload publish the whole record, as before.
 */
function mergeSetpointsIntoRecordLists(config: JsonObject): void {
  replaceCsvAndJsonTransformers(config, SETPOINT_TRANSFORMER_REPLACEMENTS, toSetpointTransformerOptions);
  for (const transformer of asObjects(config.transformers)) {
    const settings = transformer.settings as JsonObject;
    settings.inputType = toSetpointFreeDataType(settings.inputType as string);
    settings.outputType = toSetpointFreeDataType(settings.outputType as string);
  }

  const recordListToMqttIds = asObjects(config.transformers)
    .filter(
      transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === recordListToMqttManifest.id
    )
    .map(transformer => transformer.oIBusInternalId);
  const setRecordPayload = (link: JsonObject): void => {
    if (!recordListToMqttIds.includes(link.transformerId)) return;
    link.options = { ...((link.options as JsonObject | null) ?? {}) };
    setMissing(link.options as JsonObject, 'payload', 'record');
  };
  forEachNorth(config, null, north => asObjects((north.settings as JsonObject).transformers).forEach(setRecordPayload));
  forEachHistoryQuery(config, null, settings => asObjects(settings.northTransformers).forEach(setRecordPayload));
}

/** The 'file' transformer, sending the files as they are, is replaced by file-to-file (see `FILE_AS_IS_OPTIONS`) */
function replaceFileTransformer(config: JsonObject): void {
  replaceCsvAndJsonTransformers(config, FILE_AS_IS_REPLACEMENT, () => structuredClone(FILE_AS_IS_OPTIONS));
}

/**
 * The File Writer and SFTP North connectors no longer add a prefix and a suffix to the name of the files they send: the
 * `prefix` and `suffix` settings are removed, and added to the filename of their file-to-file and record-list-to-file
 * transformers (see `withPrefixAndSuffix`). Their custom transformers name the files themselves.
 */
function moveFilenamePrefixAndSuffixToTransformers(config: JsonObject): void {
  const namesFiles = (transformerId: unknown): boolean =>
    asObjects(config.transformers).some(
      transformer =>
        transformer.oIBusInternalId === transformerId &&
        transformer.type === 'standard' &&
        FILENAME_FUNCTION_NAMES.includes((transformer.settings as JsonObject).functionName as string)
    );
  /** Removes the prefix and suffix settings of a North, adding them to the filename of its transformers */
  const move = (owner: JsonObject, key: string, links: Array<JsonObject>, northName: string): void => {
    const settings = owner[key] as JsonObject | undefined;
    if (settings?.prefix === undefined && settings?.suffix === undefined) return;
    const { prefix, suffix, ...rest } = settings;
    owner[key] = rest;
    if (!prefix && !suffix) return;
    for (const link of links) {
      const options = link.options as JsonObject | null;
      if (!namesFiles(link.transformerId) || typeof options?.filename !== 'string') continue;
      link.options = {
        ...options,
        filename: withPrefixAndSuffix(options.filename, (prefix as string | null) ?? '', (suffix as string | null) ?? '', northName)
      };
    }
  };

  forEachNorth(config, null, north => {
    if (!PREFIXING_NORTH_TYPES.includes(north.type as string)) return;
    const settings = north.settings as JsonObject;
    move(settings, 'settings', asObjects(settings.transformers), settings.name as string);
  });
  forEachHistoryQuery(config, null, settings => {
    if (!PREFIXING_NORTH_TYPES.includes(settings.northType as string)) return;
    move(settings, 'northSettings', asObjects(settings.northTransformers), settings.name as string);
  });
}

/**
 * The OPC UA South and North settings gain connection (and write) timeouts, and the OPC UA South flush settings move into
 * a new `subscription` group (see `toOPCUASouthSettings`).
 */
function addOPCUATimeoutsAndSubscriptionSettings(config: JsonObject): void {
  const update = (owner: JsonObject, key: string, convert: (settings: Record<string, unknown>) => Record<string, unknown>): void => {
    if (owner[key]) owner[key] = convert(owner[key] as JsonObject);
  };
  forEachSouth(config, 'opcua', south => update(south.settings as JsonObject, 'settings', toOPCUASouthSettings));
  forEachNorth(config, 'opcua', north => update(north.settings as JsonObject, 'settings', toOPCUANorthSettings));
  forEachHistoryQuery(config, 'opcua', settings => update(settings, 'southSettings', toOPCUASouthSettings));
  forEachHistoryQuery(config, null, settings => {
    if (settings.northType === 'opcua') update(settings, 'northSettings', toOPCUANorthSettings);
  });
}

/**
 * The database South settings gain a `maxParallelRun` and a `connectionSettings` group (see `toDatabaseSouthSettings`), for
 * the connectors and the history queries. The request timeout of the MSSQL and PostgreSQL ones moves to their items.
 */
function addDatabaseConnectionSettings(config: JsonObject): void {
  for (const southType of ITEM_REQUEST_TIMEOUT_SOUTH_TYPES) {
    forEachSouthItem(config, southType, (item, south) => {
      item.settings = withItemRequestTimeout(item.settings as JsonObject, (south.settings as JsonObject).settings as JsonObject);
    });
    forEachHistoryQueryItem(config, southType, (item, settings) => {
      item.settings = withItemRequestTimeout(item.settings as JsonObject, settings.southSettings as JsonObject);
    });
  }
  for (const southType of MAX_PARALLEL_RUN_SOUTH_TYPES) {
    forEachSouth(config, southType, south => {
      const settings = south.settings as JsonObject;
      if (settings.settings) settings.settings = toDatabaseSouthSettings(southType, settings.settings as JsonObject);
    });
    forEachHistoryQuery(config, southType, settings => {
      if (settings.southSettings) settings.southSettings = toDatabaseSouthSettings(southType, settings.southSettings as JsonObject);
    });
  }
}

/** Whether a North transformer applies to the OIBus API */
function usesOIBusApi(config: JsonObject): boolean {
  let used = false;
  forEachNorth(config, null, north => {
    used ||= asObjects((north.settings as JsonObject).transformers).some(
      link => (link.source as JsonObject | undefined)?.type === 'oibus-api'
    );
  });
  return used;
}

export const upgrade: ConfigUpgrade = {
  version: '3.10.0',
  description:
    'Add scan mode scheduling types, certificate chains, item caching strategies and configuration workflows; ' +
    'move SQL items CSV serialization to record-list-to-csv transformers; replace the raw resampling of OPC UA and OPC items with none; ' +
    'replace the time-values transformers and data type by record-list ones, sending the point-based souths to OIAnalytics through ' +
    'record-list-to-oianalytics transformers; replace the iso and ignore transformers by passthroughs, the data without transformer ' +
    'being dropped; group the options of the record-list-to-oianalytics transformers by reference, timestamp and value; ' +
    'rename the any data type file; replace the csv-to-mqtt, csv-to-record-list and json-to-oianalytics transformers by ' +
    'file-to-mqtt, file-to-record-list and file-to-oianalytics ones, reading both CSV and JSON files; replace the json-to-csv, ' +
    'record-list-to-csv and record-list-to-json transformers by file-to-file and record-list-to-file ones, writing both CSV and JSON files; ' +
    'only send files to the File Writer North; send record lists from the South OIAnalytics, its CSV files being written by ' +
    'record-list-to-file transformers; compress the files of the folder scanner, FTP and SFTP souths in file-to-file transformers; ' +
    'send the OIAnalytics setpoints as record lists, replacing the setpoint transformers by record-list ones; ' +
    'replace the file transformer by file-to-file ones sending the files as they are; ' +
    'move the filename prefix and suffix of the File Writer and SFTP norths to the filename of their transformers; ' +
    'add the connection and write timeouts of the OPC UA norths, and the connection timeout and subscription settings of the OPC UA souths; ' +
    'add the description of the south and history query items; ' +
    'add the empty interval strategy of the history items and groups, keeping the tracked instant when no data is found; ' +
    'add the max parallel runs of the InfluxDB, MSSQL, MySQL, ODBC, Oracle and PostgreSQL souths, keeping their queries sequential, ' +
    'and group the connection settings of the InfluxDB, MSSQL, MySQL, Oracle and PostgreSQL souths, with the idle timeout of their connection pool; ' +
    'move the request timeout of the MSSQL and PostgreSQL souths to their items; ' +
    'add the setting enabling the content endpoints of the web server, enabled when a North transformer applies to the OIBus API',
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
      // Enabled when the OIBus API was used, before replaceIsoAndIgnoreTransformers adds a transformer applying to it to every North
      if (engineSettings.webServer) setMissing(engineSettings.webServer as JsonObject, 'enableContentEndpoint', usesOIBusApi(config));
    }

    forEachSouth(config, null, south => {
      const settings = south.settings as JsonObject;
      setMissing(settings, 'configurationWorkflows', []);
      const defaultCachingStrategy = IOT_FAMILY_SOUTH_TYPES.includes(south.type as string) ? 'allValues' : null;
      const defaultEmptyIntervalStrategy = HISTORY_SOUTH_TYPES.includes(south.type as string) ? 'keep' : null;
      for (const item of asObjects(settings.items)) {
        setMissing(item, 'cachingStrategy', defaultCachingStrategy);
        setMissing(item, 'emptyIntervalStrategy', defaultEmptyIntervalStrategy);
        for (const key of [
          'description',
          'thresholdType',
          'threshold',
          'rangeLow',
          'rangeHigh',
          'maxCachingInterval',
          'createdByWorkflowId',
          'disabledReason'
        ]) {
          setMissing(item, key, null);
        }
      }
      for (const group of asObjects(settings.groups)) {
        setMissing(group.historySettings as JsonObject, 'cachingStrategy', defaultCachingStrategy);
        setMissing(group.historySettings as JsonObject, 'emptyIntervalStrategy', defaultEmptyIntervalStrategy);
      }
    });
    forEachHistoryQueryItem(config, null, item => setMissing(item, 'description', null));

    for (const southType of RAW_RESAMPLING_SOUTH_TYPES) {
      const updateResampling = (item: JsonObject): void => {
        item.settings = toNoneResamplingItemSettings(southType, item.settings as JsonObject) ?? item.settings;
      };
      forEachSouthItem(config, southType, updateResampling);
      forEachHistoryQueryItem(config, southType, updateResampling);
    }

    const addReferenceProcess = (link: JsonObject): void => {
      if (!OIANALYTICS_TRANSFORMER_FUNCTION_NAMES.includes(catalog.functionName(link.transformerId) ?? '')) return;
      link.options = { ...((link.options as JsonObject | null) ?? {}) };
      setMissing(link.options as JsonObject, 'referenceProcess', null);
    };
    forEachNorth(config, null, north => asObjects((north.settings as JsonObject).transformers).forEach(addReferenceProcess));
    forEachHistoryQuery(config, null, settings => asObjects(settings.northTransformers).forEach(addReferenceProcess));

    if (migrateTimeValuesTransformers(config)) {
      addOIAnalyticsTransformers(config);
    }
    replaceIsoAndIgnoreTransformers(config);

    const oiaTransformerIds = asObjects(config.transformers)
      .filter(
        transformer =>
          transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME
      )
      .map(transformer => transformer.oIBusInternalId);
    const groupOIAnalyticsOptions = (link: JsonObject): void => {
      if (oiaTransformerIds.includes(link.transformerId)) {
        link.options = toGroupedOIAnalyticsOptions((link.options as JsonObject | null) ?? {});
      }
    };
    forEachNorth(config, null, north => asObjects((north.settings as JsonObject).transformers).forEach(groupOIAnalyticsOptions));
    forEachHistoryQuery(config, null, settings => asObjects(settings.northTransformers).forEach(groupOIAnalyticsOptions));

    replaceCsvAndJsonTransformers(config, FILE_TRANSFORMER_REPLACEMENTS, toFileTransformerOptions);
    replaceCsvAndJsonTransformers(config, FILE_OUTPUT_TRANSFORMER_REPLACEMENTS, toFileOutputTransformerOptions);

    for (const transformer of asObjects(config.transformers)) {
      const settings = transformer.settings as JsonObject;
      settings.inputType = toFileDataType(settings.inputType as string);
      settings.outputType = toFileDataType(settings.outputType as string);
    }

    convertFileWriterLinks(config);
    convertOIAnalyticsSouths(config);
    moveCompressionToNorths(config);
    mergeSetpointsIntoRecordLists(config);
    replaceFileTransformer(config);
    moveFilenamePrefixAndSuffixToTransformers(config);
    addOPCUATimeoutsAndSubscriptionSettings(config);
    addDatabaseConnectionSettings(config);

    return config;
  }
};
