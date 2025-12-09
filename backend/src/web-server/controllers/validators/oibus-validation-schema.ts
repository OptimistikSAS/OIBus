import Joi from 'joi';
import { validateCronExpression } from '../../../service/utils';

const scanModeSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  cron: Joi.string().custom(cronValidator).required()
});

const certificateSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  regenerateCertificate: Joi.boolean(),
  options: Joi.object({
    commonName: Joi.string().required(),
    countryName: Joi.string().required(),
    localityName: Joi.string().required(),
    organizationName: Joi.string().required(),
    stateOrProvinceName: Joi.string().required(),
    daysBeforeExpiry: Joi.number().min(1),
    keySize: Joi.number().min(1)
  }).when('regenerateCertificate', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null)
  })
});

const engineSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  port: Joi.number().required().port(),
  proxyEnabled: Joi.boolean().required(),
  proxyPort: Joi.number().port().optional().allow(null),
  logParameters: Joi.object({
    console: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace')
    }),
    file: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      maxFileSize: Joi.number().integer().required().min(1),
      numberOfFiles: Joi.number().integer().required().min(1)
    }),
    database: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      maxNumberOfLogs: Joi.number().integer().required().min(100_000)
    }),
    loki: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      interval: Joi.number().integer().required().min(10),
      address: Joi.string().allow('', null),
      username: Joi.string().allow('', null),
      password: Joi.string().allow('', null)
    }),
    oia: Joi.object({
      level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
      interval: Joi.number().integer().required().min(10)
    })
  })
});

const contentSchema: Joi.ObjectSchema = Joi.object({
  type: Joi.string().required().allow('any', 'time-values'),
  content: Joi.array().when('type', {
    is: Joi.string().valid('time-values'),
    then: Joi.required(),
    otherwise: Joi.allow('').optional()
  }),
  filePath: Joi.string().when('type', {
    is: Joi.string().valid('any'),
    then: Joi.required(),
    otherwise: Joi.allow('').optional()
  })
});

const registrationSchema: Joi.ObjectSchema = Joi.object({
  host: Joi.string().required(),
  acceptUnauthorized: Joi.boolean().required(),
  useProxy: Joi.boolean().required(),
  proxyUrl: Joi.string().optional().allow(''),
  proxyUsername: Joi.string().optional().allow(''),
  proxyPassword: Joi.string().optional().allow(''),
  commandRefreshInterval: Joi.number().integer().required().min(1),
  commandRetryInterval: Joi.number().integer().required().min(1),
  messageRetryInterval: Joi.number().integer().required().min(1),
  commandPermissions: Joi.object({
    updateVersion: Joi.boolean().required(),
    restartEngine: Joi.boolean().required(),
    regenerateCipherKeys: Joi.boolean().required(),
    updateEngineSettings: Joi.boolean().required(),
    updateRegistrationSettings: Joi.boolean().required(),
    createScanMode: Joi.boolean().required(),
    updateScanMode: Joi.boolean().required(),
    deleteScanMode: Joi.boolean().required(),
    createIpFilter: Joi.boolean().required(),
    updateIpFilter: Joi.boolean().required(),
    deleteIpFilter: Joi.boolean().required(),
    createCertificate: Joi.boolean().required(),
    updateCertificate: Joi.boolean().required(),
    deleteCertificate: Joi.boolean().required(),
    createHistoryQuery: Joi.boolean().required(),
    updateHistoryQuery: Joi.boolean().required(),
    deleteHistoryQuery: Joi.boolean().required(),
    createOrUpdateHistoryItemsFromCsv: Joi.boolean().required(),
    testHistoryNorthConnection: Joi.boolean().required(),
    testHistorySouthConnection: Joi.boolean().required(),
    testHistorySouthItem: Joi.boolean().required(),
    createSouth: Joi.boolean().required(),
    updateSouth: Joi.boolean().required(),
    deleteSouth: Joi.boolean().required(),
    createOrUpdateSouthItemsFromCsv: Joi.boolean().required(),
    testSouthConnection: Joi.boolean().required(),
    testSouthItem: Joi.boolean().required(),
    createNorth: Joi.boolean().required(),
    updateNorth: Joi.boolean().required(),
    deleteNorth: Joi.boolean().required(),
    testNorthConnection: Joi.boolean().required(),
    setpoint: Joi.boolean().required(),
    searchNorthCacheContent: Joi.boolean().required(),
    getNorthCacheFileContent: Joi.boolean().required(),
    removeNorthCacheContent: Joi.boolean().required(),
    moveNorthCacheContent: Joi.boolean().required(),
    searchHistoryCacheContent: Joi.boolean().required(),
    getHistoryCacheFileContent: Joi.boolean().required(),
    removeHistoryCacheContent: Joi.boolean().required(),
    moveHistoryCacheContent: Joi.boolean().required()
  }).required()
});

const ipFilterSchema: Joi.ObjectSchema = Joi.object({
  address: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});

const historyQuerySchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  enabled: Joi.boolean(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  southType: Joi.string().required().allow(null, ''),
  northType: Joi.string().required().allow(null, ''),
  southSettings: Joi.object().required(),
  northSettings: Joi.object().required(),
  caching: Joi.object().required(),
  archive: Joi.object().required()
});

const userSchema: Joi.ObjectSchema = Joi.object({
  login: Joi.string().required().min(4),
  firstName: Joi.optional(),
  lastName: Joi.optional(),
  email: Joi.optional(),
  language: Joi.string().required(),
  timezone: Joi.string().required()
});

const logSchema: Joi.ObjectSchema = Joi.object({});

const transformerSchema: Joi.ObjectSchema = Joi.object({
  type: Joi.string().required().allow('custom'),
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  inputType: Joi.string().required(),
  outputType: Joi.string().required(),
  language: Joi.string().required(),
  customCode: Joi.string().required(),
  customManifest: Joi.object().required()
});

function cronValidator(value: string, helper: Joi.CustomHelpers) {
  const cronValidation = validateCronExpression(value);
  return cronValidation.isValid ? true : helper.message({ custom: cronValidation.errorMessage });
}

export {
  scanModeSchema,
  certificateSchema,
  engineSchema,
  registrationSchema,
  ipFilterSchema,
  userSchema,
  historyQuerySchema,
  logSchema,
  contentSchema,
  transformerSchema
};
