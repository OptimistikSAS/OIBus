import Joi from 'joi';
import { DateTime } from 'luxon';

import { INPUT_TYPES, OUTPUT_TYPES } from '../../../../shared/model/connector/transformer-manifest.model';
import { AUTH_TOKEN_DURATIONS, WEB_SERVER_CERTIFICATE_SOURCES } from '../../../../shared/model/domain/engine.model';
import { INTERVAL_UNITS, SCAN_MODE_TYPES, ScanModeInterval } from '../../../../shared/model/domain/scan-mode.model';
import { SERVER_CERTIFICATE_VALIDATIONS } from '../../../../shared/model/domain/server-identity.model';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../../../shared/model/domain/user.model';

import { intervalToMs, MAX_INTERVAL_MS, MIN_INTERVAL_MS } from '../../../service/scan-mode.utils';
import { validateCronExpression } from '../../../service/utils';

const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const activationWindowSchema: Joi.ObjectSchema = Joi.object({
  dateRange: Joi.object({
    start: Joi.string().isoDate().allow(null),
    end: Joi.string().isoDate().allow(null)
  }).allow(null),
  recurring: Joi.object({
    timezone: Joi.string().custom(timezoneValidator).required(),
    daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).unique().allow(null),
    timeOfDay: Joi.object({
      start: Joi.string().pattern(TIME_OF_DAY_REGEX).required().messages({
        'string.pattern.base': '"timeOfDay.start" must be a time of day in HH:mm format'
      }),
      end: Joi.string().pattern(TIME_OF_DAY_REGEX).required().messages({
        'string.pattern.base': '"timeOfDay.end" must be a time of day in HH:mm format'
      })
    }).allow(null)
  }).allow(null)
});

const scanModeSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  type: Joi.string()
    .valid(...SCAN_MODE_TYPES)
    .required(),
  cron: Joi.when('type', {
    is: 'cron',
    then: Joi.string().custom(cronValidator).required(),
    // Interval scan modes still persist an empty cron, so accept and ignore whatever is sent.
    otherwise: Joi.string().allow(null, '').optional()
  }),
  interval: Joi.when('type', {
    is: 'interval',
    then: Joi.object({
      value: Joi.number().integer().positive().required(),
      unit: Joi.string()
        .valid(...INTERVAL_UNITS)
        .required()
    })
      .custom(intervalBoundsValidator)
      .required(),
    otherwise: Joi.valid(null).optional()
  }),
  activationWindow: activationWindowSchema.allow(null)
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

const certificateImportSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});

const certificatePrivateKeyExportSchema: Joi.ObjectSchema = Joi.object({
  passphrase: Joi.string().min(8).max(1024).required()
});

const engineLoggerSchema = Joi.object({
  auditRetentionDuration: Joi.number().integer().min(0).allow(null),
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
  }),
  syslog: Joi.object({
    level: Joi.string().required().allow('silent', 'error', 'warning', 'info', 'debug', 'trace'),
    host: Joi.string().allow('', null),
    port: Joi.number().integer().required().min(1).max(65535),
    protocol: Joi.string().valid('udp4', 'tcp').required()
  })
});

const engineGeneralSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});

// The certificate (from the store or from files) is only required when HTTPS is enabled
const engineWebServerHttpsSchema: Joi.ObjectSchema = Joi.object({
  enabled: Joi.boolean().required(),
  certificateSource: Joi.string()
    .required()
    .valid(...WEB_SERVER_CERTIFICATE_SOURCES),
  certificateId: Joi.when('enabled', {
    is: true,
    then: Joi.when('certificateSource', { is: 'store', then: Joi.string().required(), otherwise: Joi.string().allow(null, '') }),
    otherwise: Joi.string().allow(null, '')
  }),
  certificatePath: Joi.when('enabled', {
    is: true,
    then: Joi.when('certificateSource', { is: 'file', then: Joi.string().required(), otherwise: Joi.string().allow(null, '') }),
    otherwise: Joi.string().allow(null, '')
  }),
  privateKeyPath: Joi.when('enabled', {
    is: true,
    then: Joi.when('certificateSource', { is: 'file', then: Joi.string().required(), otherwise: Joi.string().allow(null, '') }),
    otherwise: Joi.string().allow(null, '')
  })
});

const engineWebServerSchema: Joi.ObjectSchema = Joi.object({
  port: Joi.number().required().port(),
  authTokenDuration: Joi.string()
    .required()
    .valid(...AUTH_TOKEN_DURATIONS),
  https: engineWebServerHttpsSchema.optional(),
  enableContentEndpoint: Joi.boolean().optional()
});

const engineProxySchema: Joi.ObjectSchema = Joi.object({
  enabled: Joi.boolean().required(),
  port: Joi.number().port().optional().allow(null),
  username: Joi.string().optional().allow(null, ''),
  password: Joi.string().optional().allow(null, ''),
  forward: Joi.object({
    enabled: Joi.boolean().required(),
    url: Joi.string().uri().optional().allow(null, ''),
    username: Joi.string().optional().allow(null, ''),
    password: Joi.string().optional().allow(null, '')
  }).optional()
});

const engineSchema: Joi.ObjectSchema = Joi.object({
  general: engineGeneralSchema.required(),
  webServer: engineWebServerSchema.required(),
  proxyServer: engineProxySchema.required(),
  logger: engineLoggerSchema.required()
});

const registrationSchema: Joi.ObjectSchema = Joi.object({
  host: Joi.string().required(),
  certificateValidation: Joi.string()
    .required()
    .valid(...SERVER_CERTIFICATE_VALIDATIONS),
  trustedCertificateId: Joi.string().optional().allow(null),
  serverTrust: Joi.object().optional(),
  useProxy: Joi.boolean().required(),
  proxyUrl: Joi.string().optional().allow('', null),
  proxyUsername: Joi.string().optional().allow('', null),
  proxyPassword: Joi.string().optional().allow('', null),
  useApiGateway: Joi.boolean().required(),
  apiGatewayHeaderKey: Joi.string().optional().allow('', null),
  apiGatewayHeaderValue: Joi.string().optional().allow('', null),
  apiGatewayBaseEndpoint: Joi.string().optional().allow('', null),
  commandRefreshInterval: Joi.number().integer().required().min(1),
  commandRetryInterval: Joi.number().integer().required().min(1),
  messageRetryInterval: Joi.number().integer().required().min(1),
  commandPermissions: Joi.object({
    updateVersion: Joi.boolean().required(),
    operate: Joi.boolean().required(),
    configureEngine: Joi.boolean().required(),
    configureDataFlow: Joi.boolean().required(),
    configureCustomCode: Joi.boolean().required(),
    manageAccess: Joi.boolean().required(),
    manageRegistration: Joi.boolean().required(),
    connectToDataSources: Joi.boolean().required(),
    manageCache: Joi.boolean().required(),
    diagnostics: Joi.boolean().required(),
    setpoint: Joi.boolean().required()
  }).required()
});

const ipFilterSchema: Joi.ObjectSchema = Joi.object({
  address: Joi.string().required(),
  description: Joi.string().required().allow(null, '')
});

const userSchema: Joi.ObjectSchema = Joi.object({
  login: Joi.string().required().min(4),
  firstName: Joi.optional(),
  lastName: Joi.optional(),
  email: Joi.optional(),
  language: Joi.string().required(),
  timezone: Joi.string().required()
});

const passwordSchema = Joi.string().required().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

const userPasswordSchema: Joi.ObjectSchema = Joi.object({
  password: passwordSchema
});

const changePasswordSchema: Joi.ObjectSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema
});

const transformerSchema: Joi.ObjectSchema = Joi.object({
  type: Joi.string().required().allow('custom'),
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  inputType: Joi.string()
    .required()
    .valid(...INPUT_TYPES),
  outputType: Joi.string()
    .required()
    .valid(...OUTPUT_TYPES),
  language: Joi.string().required(),
  customCode: Joi.string().required(),
  customManifest: Joi.object().required(),
  timeout: Joi.number().integer().min(100).required()
});

function cronValidator(value: string, helper: Joi.CustomHelpers) {
  const cronValidation = validateCronExpression(value);
  return cronValidation.isValid ? true : helper.message({ custom: cronValidation.errorMessage });
}

/**
 * The bounds are checked on the resolved millisecond value rather than per unit, so both
 * `{ value: 5, unit: 'ms' }` and an interval overflowing Node's setInterval limit are rejected.
 */
function intervalBoundsValidator(value: ScanModeInterval, helper: Joi.CustomHelpers) {
  const milliseconds = intervalToMs(value);
  if (milliseconds < MIN_INTERVAL_MS) {
    return helper.message({ custom: `"interval" must be at least ${MIN_INTERVAL_MS} ms (got ${milliseconds} ms)` });
  }
  if (milliseconds > MAX_INTERVAL_MS) {
    return helper.message({ custom: `"interval" must not exceed ${MAX_INTERVAL_MS} ms (got ${milliseconds} ms)` });
  }
  return value;
}

/** IANA zone validity is delegated to luxon rather than a hardcoded list. */
function timezoneValidator(value: string, helper: Joi.CustomHelpers) {
  return DateTime.now().setZone(value).isValid ? value : helper.message({ custom: `"${value}" is not a valid IANA timezone` });
}

export {
  certificateImportSchema,
  certificatePrivateKeyExportSchema,
  certificateSchema,
  changePasswordSchema,
  engineGeneralSchema,
  engineLoggerSchema,
  engineProxySchema,
  engineSchema,
  engineWebServerSchema,
  ipFilterSchema,
  registrationSchema,
  scanModeSchema,
  transformerSchema,
  userPasswordSchema,
  userSchema
};
