import {
  Document,
  MongoClient,
  MongoClientOptions,
  MongoNetworkError,
  MongoServerError,
  MongoServerSelectionError,
  ObjectId
} from 'mongodb';

import { JSONPath } from 'jsonpath-plus';

import SouthConnector from '../south-connector';
import { convertDateTimeToInstant, getErrorMessage, workUnitLogCtx } from '../../service/utils';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../../shared/model/types';
import { SouthHistoryQuery } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthItemSettings, SouthMongoDBItemSettings, SouthMongoDBSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthMongoDB - Retrieve documents from a MongoDB collection and send them as record-list
 * content to the cache. Documents are flattened to their top-level fields only (nested
 * objects/arrays are stringified) before being cached; the raw (pre-flattening) documents are used
 * to substitute `@StartTime`/`@EndTime` into BSON `Date` values, and to track the incremental cursor
 * via a JSONPath expression against the item's `trackingInstant` settings.
 */
export default class SouthMongoDB extends SouthConnector<SouthMongoDBSettings, SouthMongoDBItemSettings> implements SouthHistoryQuery {
  constructor(
    connector: SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  private async createClientOptions(): Promise<MongoClientOptions> {
    return {
      connectTimeoutMS: this.connector.settings.connectionTimeout,
      serverSelectionTimeoutMS: this.connector.settings.connectionTimeout,
      auth: this.connector.settings.username
        ? {
            username: this.connector.settings.username,
            password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : undefined
          }
        : undefined
    };
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const options = await this.createClientOptions();

    let client;
    try {
      client = new MongoClient(this.connector.settings.connectionString, options);
      await client.connect();
    } catch (error: unknown) {
      if (client) {
        await client.close();
      }

      if (error instanceof MongoServerError && (error.codeName === 'AuthenticationFailed' || error.code === 18)) {
        throw new Error(`Please check username and password. ${getErrorMessage(error)}`);
      }

      if (error instanceof MongoServerSelectionError || error instanceof MongoNetworkError) {
        throw new Error(`Please check connection string. ${getErrorMessage(error)}`);
      }

      throw new Error(`Unexpected error. ${getErrorMessage(error)}`);
    }

    let collectionCount;
    try {
      const collections = await client.db().listCollections().toArray();
      collectionCount = collections.length;
    } catch (error: unknown) {
      await client.close();
      throw new Error(`Unable to list collections in database. ${getErrorMessage(error)}`);
    }

    if (collectionCount === 0) {
      await client.close();
      throw new Error('Database has no collections');
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Collections', value: String(collectionCount) }];

    try {
      const buildInfo = await client.db().admin().buildInfo();
      const version = buildInfo?.version;
      if (version) {
        items.unshift({ key: 'Version', value: String(version) });
      }
    } catch {
      // Version info not available
    }

    await client.close();
    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthMongoDBItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const queryStart = DateTime.now().toMillis();
    const result = await this.queryData(item, startTime, endTime);
    const queryDuration = DateTime.now().toMillis() - queryStart;

    return {
      result: { type: 'record-list', content: result },
      // Connect + query happen together inside the query call above — splitting them would mean
      // refactoring a method the scheduled query path also uses, so connectionDuration stays 0 and
      // queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
  }

  /**
   * Get documents from the collection between startTime and endTime (if used in the query) and send
   * them to the cache as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthMongoDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const item = items[0];
    const logCtx = workUnitLogCtx(items);

    const startRequest = DateTime.now();
    const documents = await this.fetchDocuments(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    let updatedStartTime: Instant | null = null;
    let result: Array<OIBusRecord> = [];
    if (documents.length > 0) {
      result = documents.map(toOIBusRecord);
      this.logger.info(logCtx, `Found ${result.length} results in ${requestDuration} ms`);
      updatedStartTime = this.trackMaxInstant(item, documents);
      await this.addContent({ type: 'record-list', content: result }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
  }

  /**
   * Extract the incremental cursor from the raw (pre-flattening) documents using the item's
   * `trackingInstant` settings: a JSONPath expression picks the candidate values out of the
   * documents (reaching into nested fields if needed), each is converted to an Instant via the
   * configured `dateTimeInput` type, and the max is returned. Returns null when tracking is
   * disabled, or when no value could be extracted/converted.
   */
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthMongoDBItemSettings>, docs: Array<Document>): Instant | null {
    if (!item.settings.trackingInstant?.trackInstant) return null;
    const { jsonPath, dateTimeInput } = item.settings.trackingInstant;

    const rawValues = JSONPath({ json: docs, path: jsonPath! });
    if (!rawValues || rawValues.length === 0) return null;

    return (rawValues as Array<unknown>)
      .map(value => {
        if (value === null || value === undefined) return null;
        return convertDateTimeToInstant(value as string | number | Date, {
          type: dateTimeInput!.type!,
          timezone: dateTimeInput!.timezone,
          format: dateTimeInput!.format,
          locale: dateTimeInput!.locale
        });
      })
      .filter((instant): instant is Instant => instant !== null)
      .reduce((max: Instant | null, current: Instant) => (!max || current > max ? current : max), null);
  }

  /**
   * Apply the `find`/`aggregation` query to the target MongoDB collection. `@StartTime`/`@EndTime`
   * placeholders (as quoted JSON string literals) are substituted with BSON `Date` values before the
   * query runs. Returns the raw driver documents (used for cursor tracking); callers that need cache
   * content should flatten via `toOIBusRecord`.
   */
  private async fetchDocuments(
    item: SouthConnectorItemEntity<SouthMongoDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Document>> {
    const queryDocument = substituteQueryPlaceholders(item.settings.query, startTime, endTime);
    const sortSpec = JSON.parse(item.settings.sort) as Document;
    const options = await this.createClientOptions();

    let client;
    try {
      client = new MongoClient(this.connector.settings.connectionString, options);
      await client.connect();
      const collection = client.db().collection(item.settings.collection);

      let documents: Array<Document>;
      if (item.settings.queryType === 'aggregation') {
        // Pipeline authors control their own $sort; a bolted-on $sort could reference a field that no
        // longer exists after a $group stage, so `sort` is not applied to aggregation queries.
        documents = await collection.aggregate(queryDocument as Array<Document>).toArray();
      } else {
        documents = await collection
          .find(queryDocument as Document)
          .sort(sortSpec)
          .toArray();
      }

      await client.close();
      return documents;
    } catch (error) {
      if (client) {
        await client.close();
      }
      throw error;
    }
  }

  /**
   * Apply the `find`/`aggregation` query to the target MongoDB collection and return the results
   * flattened to their top-level fields only. Used by `testItem()` for the UI preview.
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthMongoDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    const documents = await this.fetchDocuments(item, startTime, endTime);
    return documents.map(toOIBusRecord);
  }
}

/**
 * Substitute `@StartTime`/`@EndTime` placeholders (written as quoted JSON string literals, e.g.
 * `{"timestamp": {"$gt": "@StartTime"}}`) with unique sentinel strings embedding the ISO value, then
 * JSON.parse and recursively replace any string exactly matching a sentinel pattern with a BSON
 * `Date`. Returns the parsed query document (object) or pipeline (array).
 */
export function substituteQueryPlaceholders(queryText: string, startTime: Instant, endTime: Instant): unknown {
  const startSentinel = `__OIBUS_START_TIME_SENTINEL__${startTime}__`;
  const endSentinel = `__OIBUS_END_TIME_SENTINEL__${endTime}__`;

  const substitutedText = queryText.replace(/@StartTime/g, startSentinel).replace(/@EndTime/g, endSentinel);

  const parsed = JSON.parse(substitutedText);
  return replaceDateSentinels(parsed, startSentinel, startTime, endSentinel, endTime);
}

function replaceDateSentinels(value: unknown, startSentinel: string, startTime: Instant, endSentinel: string, endTime: Instant): unknown {
  if (typeof value === 'string') {
    if (value === startSentinel) return new Date(startTime);
    if (value === endSentinel) return new Date(endTime);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(entry => replaceDateSentinels(entry, startSentinel, startTime, endSentinel, endTime));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = replaceDateSentinels(entryValue, startSentinel, startTime, endSentinel, endTime);
    }
    return result;
  }
  return value;
}

/**
 * Flatten a MongoDB document into an OIBusRecord using top-level fields only: `Date` values become
 * ISO strings, `ObjectId` values become hex strings, scalars pass through as-is, `null`/`undefined`
 * become `null`, and anything else (nested object/array/Decimal128/Binary/…) is JSON-stringified.
 */
export function toOIBusRecord(doc: Document): OIBusRecord {
  const record: OIBusRecord = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === null || value === undefined) {
      record[key] = null;
    } else if (value instanceof Date) {
      record[key] = value.toISOString();
    } else if (value instanceof ObjectId) {
      record[key] = value.toHexString();
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      record[key] = value;
    } else {
      record[key] = JSON.stringify(value);
    }
  }
  return record;
}
