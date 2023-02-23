import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import Joi from "joi";

const manifest: SouthConnectorManifest = {
  name: 'SQL',
  category: 'database',
  description: 'SQL description',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    historyPoint: false,
    historyFile: true
  },
  settings: [
    {
      key: 'driver',
      type: 'OibSelect',
      options: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'],
      label: 'SQL Driver',
      defaultValue: 'MSSQL',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'databasePath',
      type: 'OibText',
      label: 'Database path',
      defaultValue: './test.db',
      newRow: true,
      conditionalDisplay: { driver: ['SQLite'] },
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      defaultValue: 'localhost',
      newRow: true,
      conditionalDisplay: { driver: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'] },
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 1433,
      newRow: false,
      class: 'col-2',
      conditionalDisplay: { driver: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'] },
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      readDisplay: true
    },
    {
      key: 'database',
      type: 'OibText',
      label: 'Database',
      defaultValue: 'db',
      newRow: true,
      conditionalDisplay: { driver: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'] },
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      newRow: true,
      conditionalDisplay: { driver: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'] },
      readDisplay: true
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      newRow: false,
      conditionalDisplay: { driver: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'] },
      readDisplay: false
    },
    {
      key: 'domain',
      type: 'OibText',
      label: 'Domain',
      newRow: false,
      conditionalDisplay: { driver: ['MSSQL'] },
      readDisplay: true
    },
    {
      key: 'encryption',
      type: 'OibCheckbox',
      label: 'Encryption?',
      defaultValue: false,
      newRow: true,
      conditionalDisplay: { driver: ['MSSQL'] },
      readDisplay: true
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      label: 'Connection timeout (ms)',
      defaultValue: 1000,
      newRow: true,
      class: 'col-4',
      conditionalDisplay: { driver: ['MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'] },
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      readDisplay: false
    }
  ],
  schema: Joi.object({
    driver: Joi.string().required().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite'),
    databasePath: Joi.string().when('driver', { is: 'SQLite', then: Joi.required() }),
    host: Joi.string().when('driver', { is: Joi.string().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'), then: Joi.required() }),
    port: Joi.number()
      .port()
      .when('driver', { is: Joi.string().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'), then: Joi.required() }),
    database: Joi.string().when('driver', { is: Joi.string().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'), then: Joi.required() }),
    username: Joi.string().when('driver', { is: Joi.string().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'), then: Joi.required() }),
    password: Joi.string().when('driver', { is: Joi.string().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'), then: Joi.required() }),
    domain: Joi.string().when('driver', { is: 'MSSQL', then: Joi.required() }),
    encryption: Joi.boolean().when('driver', { is: 'MSSQL', then: Joi.required() }),
    connectionTimeout: Joi.number()
      .integer()
      .min(100)
      .max(30000)
      .when('driver', { is: Joi.string().valid('MSSQL', 'MySQL', 'PostgreSQL', 'Oracle'), then: Joi.required() })
  }),
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'query',
        type: 'OibCodeBlock',
        label: 'Query',
        contentType: 'sql',
        defaultValue: 'SELECT * FROM Table WHERE timestamp > @StartTime',
        class: 'col-4 text-nowrap',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'requestTimeout',
        type: 'OibNumber',
        label: 'Request timeout (ms)',
        defaultValue: 1000,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60000 } }],
        readDisplay: false
      },
      {
        key: 'maxReadInterval',
        type: 'OibNumber',
        label: 'Max read interval (s)',
        defaultValue: 0,
        validators: [{ key: 'required' }],
        readDisplay: false
      },
      {
        key: 'readIntervalDelay',
        type: 'OibNumber',
        label: 'Read interval delay (ms)',
        defaultValue: 200,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
        readDisplay: false
      },
      {
        key: 'filename',
        type: 'OibText',
        label: 'Filename',
        defaultValue: 'sql-@CurrentDate.csv',
        readDisplay: true
      },
      {
        key: 'delimiter',
        type: 'OibSelect',
        options: [',', ';', '|'],
        label: 'Delimiter',
        defaultValue: ',',
        readDisplay: false
      },
      {
        key: 'compression',
        type: 'OibCheckbox',
        label: 'Compress File?',
        readDisplay: false
      },
      {
        key: 'timeColumn',
        type: 'OibText',
        label: 'Time column',
        defaultValue: 'timestamp',
        readDisplay: true
      },
      {
        key: 'timezone',
        type: 'OibTimezone',
        label: 'Timezone',
        readDisplay: false
      },
      {
        key: 'dateFormat',
        type: 'OibText',
        label: 'Date format',
        defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
        readDisplay: false
      }
    ],
    schema: Joi.object({
      query: Joi.string().required(),
      requestTimeout: Joi.number().integer().required().min(100).max(60000),
      maxReadInterval: Joi.number().integer().required(),
      readIntervalDelay: Joi.number().integer().required().min(100).max(3_600_000),
      filename: Joi.string(),
      delimiter: Joi.string().required().valid(',', ';', '|'),
      compression: Joi.boolean(),
      timeColumn: Joi.string(),
      timezone: Joi.string(),
      dateFormat: Joi.string()
    })
  }
};

export default manifest;
