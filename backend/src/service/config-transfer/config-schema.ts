import Joi from 'joi';
import { ipFilterSchema, scanModeSchema, userSchema } from '../../web-server/controllers/validators/oibus-validation-schema';
import { RECORD_FILTER_OPERATORS } from '../../../shared/model/configuration-workflow.model';
import { HISTORY_QUERY_STATUS } from '../../../shared/model/history-query.model';

/**
 * Structural Joi schema of the configuration (`ConfigExportDTO['config']`) in the CURRENT shape, applied
 * after the upgrade chain: every section, entity and field the import reads must be there with the
 * right type, so a missing upgrade step fails validation instead of crashing the write or importing a
 * half-understood entity. Keys not described here are allowed (validated with `allowUnknown`), so a
 * file carrying extra metadata (e.g. from OIAnalytics) still imports.
 *
 * Connector/item settings blobs are only checked to be objects here: they are validated against their
 * manifests afterwards, like the create/update endpoints do.
 *
 * Must be kept in sync with the DTOs built by `ConfigTransferBuilderService`.
 */

/**
 * The reserved scan mode id push-driven south connectors (MQTT, OPC-UA DA subscriptions, …) and the
 * engine special-case by id. It is seeded with `type: 'cron'` but an empty `cron` (nothing ever
 * schedules it), which `scanModeSchema`'s cron validator rejects, and an import only ever matches it
 * back to the local row by id, so its settings are not validated.
 */
export const RESERVED_SCAN_MODE_ID = 'subscription';

const auditFields = {
  oIBusInternalId: Joi.string().required(),
  oIBusCreatedBy: Joi.string().allow(null, ''),
  oIBusUpdatedBy: Joi.string().allow(null, ''),
  oIBusCreatedAt: Joi.string().allow(null, ''),
  oIBusUpdatedAt: Joi.string().allow(null, '')
};

const nullableNumber = Joi.number().allow(null).required();
const nullableString = Joi.string().allow(null, '').required();
const settingsBlob = Joi.object().required();

const itemLight = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  enabled: Joi.boolean().required()
});

const scanModeEntry = Joi.object({
  ...auditFields,
  settings: Joi.when('oIBusInternalId', {
    is: RESERVED_SCAN_MODE_ID,
    then: Joi.object().required(),
    otherwise: scanModeSchema.required()
  })
});

const certificateEntry = Joi.object({
  ...auditFields,
  settings: Joi.object({
    name: Joi.string().required(),
    description: nullableString,
    publicKey: Joi.string().allow('').required(),
    certificate: Joi.string().allow('').required(),
    certificateChain: nullableString,
    expiry: nullableString
  }).required()
});

const transformerEntry = Joi.object({
  oIBusInternalId: Joi.string().required(),
  type: Joi.string().valid('custom', 'standard').required(),
  settings: Joi.when('type', {
    is: 'standard',
    then: Joi.object({
      functionName: Joi.string().required(),
      inputType: Joi.string().required(),
      outputType: Joi.string().required()
    }).required(),
    otherwise: Joi.object({
      name: Joi.string().required(),
      description: nullableString,
      inputType: Joi.string().required(),
      outputType: Joi.string().required(),
      language: Joi.string().required(),
      timeout: Joi.number().integer().min(100).required(),
      customCode: Joi.string().required()
    }).required()
  }),
  manifest: Joi.object().required()
});

const southItemEntry = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  enabled: Joi.boolean().required(),
  settings: settingsBlob,
  scanModeId: Joi.string().allow(null).required(),
  scanModeName: Joi.string().allow(null),
  groupId: Joi.string().allow(null).required(),
  groupName: Joi.string().allow(null),
  syncWithGroup: Joi.boolean().required(),
  maxReadInterval: nullableNumber,
  readDelay: nullableNumber,
  startTimeOffset: nullableNumber,
  endTimeOffset: nullableNumber,
  recoveryStrategy: Joi.string().valid('oldest', 'newest').allow(null).required(),
  cachingStrategy: Joi.string().valid('allValues', 'onChange', 'threshold').allow(null).required(),
  thresholdType: Joi.string().valid('absolute', 'percentage').allow(null).required(),
  threshold: nullableNumber,
  rangeLow: nullableNumber,
  rangeHigh: nullableNumber,
  maxCachingInterval: nullableNumber
});

const southGroupEntry = Joi.object({
  id: Joi.string().required(),
  standardSettings: Joi.object({
    name: Joi.string().required(),
    scanModeId: Joi.string().required()
  }).required(),
  historySettings: Joi.object({
    startTimeOffset: nullableNumber,
    endTimeOffset: nullableNumber,
    maxReadInterval: nullableNumber,
    readDelay: nullableNumber,
    recoveryStrategy: Joi.string().valid('oldest', 'newest').allow(null).required(),
    cachingStrategy: Joi.string().valid('allValues', 'onChange', 'threshold').allow(null).required()
  }).required()
});

/**
 * Same rules `ConfigurationWorkflowService` enforces on create/update: a workflow is either local
 * (`itemFieldMapping` set, at least one identity key field) or remote (`pushToOIAnalytics`), never both
 * nor neither.
 */
const configurationWorkflowEntry = Joi.object({
  ...auditFields,
  settings: Joi.object({
    name: Joi.string().required(),
    discoveryScope: Joi.object().required(),
    identityKeyFields: Joi.array().items(Joi.string()).required(),
    eligibilityFilter: Joi.array()
      .items(
        Joi.object({
          field: Joi.string().required(),
          operator: Joi.string()
            .valid(...RECORD_FILTER_OPERATORS)
            .required(),
          value: Joi.string().allow('')
        })
      )
      .required(),
    itemFieldMapping: Joi.object().pattern(Joi.string(), Joi.string().allow('')).allow(null).required(),
    pushToOIAnalytics: Joi.boolean().required(),
    scanModeId: Joi.string().allow(null).required(),
    enabled: Joi.boolean().required()
  })
    .custom((settings: { itemFieldMapping: object | null; pushToOIAnalytics: boolean; identityKeyFields: Array<string> }, helpers) => {
      if (settings.itemFieldMapping !== null && settings.pushToOIAnalytics) {
        return helpers.message({ custom: 'A configuration workflow cannot both create/update items and push to OIAnalytics' });
      }
      if (settings.itemFieldMapping === null && !settings.pushToOIAnalytics) {
        return helpers.message({ custom: 'A configuration workflow must either create/update items or push to OIAnalytics' });
      }
      if (!settings.pushToOIAnalytics && settings.identityKeyFields.length === 0) {
        return helpers.message({ custom: 'A configuration workflow creating/updating items requires at least one identity key field' });
      }
      return settings;
    })
    .required(),
  ownedItems: Joi.array()
    .items(Joi.object({ id: Joi.string().required(), disabledReason: Joi.string().allow(null).required() }))
    .required()
});

const southEntry = Joi.object({
  ...auditFields,
  type: Joi.string().required(),
  settings: Joi.object({
    type: Joi.string().required(),
    name: Joi.string().required(),
    description: nullableString,
    enabled: Joi.boolean().required(),
    settings: settingsBlob,
    items: Joi.array().items(southItemEntry).required(),
    groups: Joi.array().items(southGroupEntry).required(),
    configurationWorkflows: Joi.array().items(configurationWorkflowEntry).required()
  }).required()
});

const cachingSchema = Joi.object({
  trigger: Joi.object({
    scanModeId: Joi.string().required(),
    scanModeName: Joi.string().allow(null),
    numberOfElements: Joi.number().required(),
    numberOfFiles: Joi.number().required()
  }).required(),
  throttling: Joi.object({
    runMinDelay: Joi.number().required(),
    maxSize: Joi.number().required(),
    maxNumberOfElements: Joi.number().required()
  }).required(),
  error: Joi.object({
    retryInterval: Joi.number().required(),
    retryCount: Joi.number().required(),
    retentionDuration: Joi.number().required()
  }).required(),
  archive: Joi.object({
    enabled: Joi.boolean().required(),
    retentionDuration: Joi.number().required()
  }).required()
}).required();

const transformerSourceSchema = Joi.object({
  type: Joi.string().valid('south', 'oianalytics-setpoint', 'oibus-api').required(),
  southId: Joi.when('type', { is: 'south', then: Joi.string().required() }),
  groupId: Joi.string(),
  items: Joi.when('type', { is: 'south', then: Joi.array().items(itemLight).required() }),
  dataSourceId: Joi.when('type', { is: 'oibus-api', then: Joi.string().required() })
}).required();

const northEntry = Joi.object({
  ...auditFields,
  type: Joi.string().required(),
  settings: Joi.object({
    type: Joi.string().required(),
    name: Joi.string().required(),
    description: nullableString,
    enabled: Joi.boolean().required(),
    settings: settingsBlob,
    caching: cachingSchema,
    transformers: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          transformerId: Joi.string().required(),
          options: Joi.object().required(),
          source: transformerSourceSchema
        })
      )
      .required()
  }).required()
});

const historyQueryEntry = Joi.object({
  ...auditFields,
  settings: Joi.object({
    name: Joi.string().required(),
    description: nullableString,
    status: Joi.string()
      .valid(...HISTORY_QUERY_STATUS)
      .required(),
    southType: Joi.string().required(),
    southSettings: settingsBlob,
    queryTimeRange: Joi.object({
      startTime: Joi.string().required(),
      endTime: Joi.string().required(),
      maxReadInterval: Joi.number().required(),
      readDelay: Joi.number().required()
    }).required(),
    northType: Joi.string().required(),
    northSettings: settingsBlob,
    caching: cachingSchema,
    items: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required(),
          enabled: Joi.boolean().required(),
          settings: settingsBlob
        })
      )
      .required(),
    northTransformers: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          transformerId: Joi.string().required(),
          options: Joi.object().required(),
          items: Joi.array().items(itemLight).required()
        })
      )
      .required()
  }).required()
});

export const CONFIG_SCHEMA = Joi.object({
  // Informational only: never imported (see `ConfigImportService.importConfiguration`)
  engine: Joi.object().required(),
  registration: Joi.object().required(),
  scanModes: Joi.array().items(scanModeEntry).required(),
  ipFilters: Joi.array()
    .items(Joi.object({ ...auditFields, settings: ipFilterSchema.required() }))
    .required(),
  certificates: Joi.array().items(certificateEntry).required(),
  southConnectors: Joi.array().items(southEntry).required(),
  northConnectors: Joi.array().items(northEntry).required(),
  users: Joi.array()
    .items(Joi.object({ ...auditFields, settings: userSchema.required() }))
    .required(),
  transformers: Joi.array().items(transformerEntry).required(),
  historyQueries: Joi.array().items(historyQueryEntry).required()
}).required();

/** Top-level shape of an export file, checked before anything else. */
export const EXPORT_FILE_SCHEMA = Joi.object({
  oibusVersion: Joi.string().required(),
  exportedAt: Joi.string(),
  config: Joi.object().required()
}).required();
