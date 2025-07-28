import { ScanMode } from '../../model/scan-mode.model';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import { NorthConnectorCommandDTO, NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorManifest
} from '../../../shared/model/south-connector.model';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { IPFilter } from '../../model/ip-filter.model';
import { EngineSettings } from '../../model/engine.model';
import {
  EngineMetrics,
  EngineSettingsCommandDTO,
  HistoryQueryMetrics,
  NorthConnectorMetrics,
  OIBusContent,
  OIBusInfo,
  SouthConnectorMetrics
} from '../../../shared/model/engine.model';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import { OIBusCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from '../../service/oia/oianalytics.model';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { HistoryQueryEntity } from '../../model/histor-query.model';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO } from '../../../shared/model/history-query.model';
import { User } from '../../model/user.model';
import { Certificate } from '../../model/certificate.model';
import { OIBusLog } from '../../model/logs.model';
import { CertificateCommandDTO } from '../../../shared/model/certificate.model';
import { LogStreamCommandDTO } from '../../../shared/model/logs.model';
import { CustomTransformerCommand } from '../../../shared/model/transformer.model';
import { Transformer } from '../../model/transformer.model';

const constants = {
  dates: {
    JANUARY_1ST_2020_EUROPE_PARIS: '2019-12-31T23:00:00.000Z',
    JANUARY_1ST_2020_UTC: '2020-01-01T00:00:00.000Z',
    JANUARY_2ND_2020_UTC: '2020-01-02T00:00:00.000Z',
    JANUARY_3RD_2020_UTC: '2020-01-03T00:00:00.000Z',
    JANUARY_4TH_2020_UTC: '2020-01-04T00:00:00.000Z',
    FEBRUARY_1ST_2020_UTC: '2020-02-01T00:00:00.000Z',
    JANUARY_1ST_2021_UTC: '2021-01-01T00:00:00.000Z',
    JANUARY_1ST_2021_EUROPE_PARIS: '2020-12-31T23:00:00.000Z',
    FEBRUARY_1ST_2021_EUROPE_PARIS: '2021-01-31T23:00:00.000Z',
    JANUARY_1ST_2021_ONE_AM_UTC: '2021-01-01T01:00:00.000Z',
    JANUARY_2ND_2021_UTC: '2021-01-02T00:00:00.000Z',
    JANUARY_2ND_2021_EUROPE_PARIS: '2021-01-01T23:00:00.000Z',
    JANUARY_2ND_2021_ONE_AM_UTC: '2021-01-02T01:00:00.000Z',
    JANUARY_3RD_2021_ONE_AM_UTC: '2021-01-03T01:00:00.000Z',
    JANUARY_3RD_2021_EUROPE_PARIS: '2021-01-02T23:00:00.000Z',
    JANUARY_4TH_2021_UTC: '2021-01-04T00:00:00.000Z',
    FAKE_NOW: '2021-01-02T00:00:00.000Z',
    FAKE_NOW_IN_FUTURE: '2099-03-01T00:00:00.000Z',
    DATE_1: '2020-03-15T00:00:00.000Z',
    DATE_2: '2020-03-20T00:00:00.000Z',
    DATE_3: '2020-03-25T00:00:00.000Z'
  }
} as const;

const ipFilterCommandDTO: IPFilterCommandDTO = {
  address: '1.1.1.1',
  description: 'my first ip filter'
};
const ipFilters: Array<IPFilter> = [
  {
    id: 'ipFilterId1',
    address: '192.168.1.1',
    description: 'my first ip filter'
  },
  {
    id: 'ipFilterId2',
    address: '*',
    description: 'All ips'
  }
];

const transformerCommandDTO: CustomTransformerCommand = {
  type: 'custom',
  name: 'my new transformer',
  description: 'description',
  inputType: 'time-values',
  outputType: 'any',
  customCode: 'console.log("Hello World");',
  customManifest: {
    type: 'object',
    key: 'transformers.options',
    translationKey: '',
    attributes: [],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};
const transformers: Array<Transformer> = [
  {
    id: 'transformerId1',
    type: 'custom',
    name: 'my transformer 1',
    description: 'description',
    inputType: 'time-values',
    outputType: 'any',
    customCode: 'console.log("Hello World");',
    customManifest: {
      type: 'object',
      key: 'transformers.options',
      translationKey: '',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    }
  },
  {
    id: 'transformerId2',
    type: 'custom',
    name: 'my transformer 2',
    description: 'description',
    inputType: 'any',
    outputType: 'any',
    customCode: 'console.log("Hello World");',
    customManifest: {
      type: 'object',
      key: 'transformers.options',
      translationKey: '',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    }
  }
];

const scanModeCommandDTO: ScanModeCommandDTO = {
  name: 'my new scan mode',
  description: 'another scan mode',
  cron: '0 * * * * *'
};
const scanModes: Array<ScanMode> = [
  {
    id: 'scanModeId1',
    name: 'scanMode1',
    description: 'my first scanMode',
    cron: '* * * * * *'
  },
  {
    id: 'scanModeId2',
    name: 'scanMode2',
    description: 'my second scanMode',
    cron: '0 * * * * *'
  },
  {
    id: 'subscription',
    name: 'Subscription',
    description: 'Subscription',
    cron: 'subscription'
  }
];

const users: Array<User> = [
  {
    id: 'user1',
    login: 'admin',
    firstName: null,
    lastName: null,
    email: null,
    language: 'en',
    timezone: 'Europe/Paris'
  },
  {
    id: 'user2',
    login: 'secondUser',
    firstName: 'first name',
    lastName: 'last name',
    email: 'email',
    language: 'fr',
    timezone: 'Europe/Paris'
  }
];
const userCommand: Omit<User, 'id'> = {
  login: 'anotherUser',
  firstName: 'first name',
  lastName: 'last name',
  email: 'another-user@mail.com',
  language: 'en',
  timezone: 'Europe/Paris'
};

const certificates: Array<Certificate> = [
  {
    id: 'certificate1',
    name: 'Certificate 1',
    description: '',
    publicKey: 'public key',
    privateKey: 'private key',
    certificate: 'certificate',
    expiry: constants.dates.DATE_1
  },
  {
    id: 'certificate2',
    name: 'Certificate 2',
    description: '',
    publicKey: 'public key',
    privateKey: 'private key',
    certificate: 'certificate',
    expiry: constants.dates.DATE_2
  }
];
const certificateCommand: CertificateCommandDTO = {
  name: 'new certificate',
  description: 'description',
  regenerateCertificate: false,
  options: {
    commonName: 'OIBus',
    countryName: 'FR',
    stateOrProvinceName: 'Savoie',
    localityName: 'Chambéry',
    organizationName: 'Optimistik',
    keySize: 4096,
    daysBeforeExpiry: 90
  }
};

const southTestManifest: SouthConnectorManifest = {
  id: 'folder-scanner',
  category: 'file',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: true,
    history: true
  },
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.south.settings',
    attributes: [],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  },
  items: {
    type: 'array',
    key: 'items',
    translationKey: 'configuration.oibus.manifest.south.items.title',
    paginate: true,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'item',
      translationKey: 'configuration.oibus.manifest.south.items.item',
      displayProperties: {
        visible: true,
        wrapInBox: false
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'configuration.oibus.manifest.south.items.name',
          defaultValue: null,
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'boolean',
          key: 'enabled',
          translationKey: 'configuration.oibus.manifest.south.items.enabled',
          defaultValue: true,
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'scan-mode',
          key: 'scanModeId',
          acceptableType: 'POLL',
          translationKey: 'configuration.oibus.manifest.south.items.scan-mode',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'object',
          key: 'settings',
          translationKey: 'configuration.oibus.manifest.south.items.settings',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'array',
              key: 'objectArray',
              translationKey: 'configuration.oibus.manifest.south.items.settings',
              paginate: true,
              numberOfElementPerPage: 20,
              validators: [],
              rootAttribute: {
                type: 'object',
                key: 'item',
                translationKey: 'configuration.oibus.manifest.south.items.item',
                displayProperties: {
                  visible: true,
                  wrapInBox: false
                },
                enablingConditions: [],
                validators: [],
                attributes: []
              }
            },
            {
              type: 'object',
              key: 'objectSettings',
              translationKey: 'configuration.oibus.manifest.south.items.settings',
              displayProperties: {
                visible: true,
                wrapInBox: false
              },
              enablingConditions: [],
              validators: [],
              attributes: []
            },
            {
              type: 'number',
              key: 'objectValue',
              translationKey: 'configuration.oibus.manifest.south.items.settings',
              defaultValue: 1,
              unit: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            }
          ]
        }
      ]
    }
  }
};
const southConnectors: Array<SouthConnectorEntity<SouthSettings, SouthItemSettings>> = [
  {
    id: 'southId1',
    name: 'South 1',
    type: 'folder-scanner',
    description: 'my folder scanner',
    enabled: true,
    settings: {
      inputFolder: 'input',
      compression: true
    },
    items: [
      {
        id: 'southItemId1',
        name: 'item1',
        enabled: true,
        settings: {} as SouthItemSettings,
        scanModeId: scanModes[0].id
      },
      {
        id: 'southItemId2',
        name: 'item2',
        enabled: true,
        settings: {} as SouthItemSettings,
        scanModeId: scanModes[1].id
      }
    ]
  },
  {
    id: 'southId2',
    name: 'South 2',
    type: 'mssql',
    description: 'my MSSQL south connector',
    enabled: false,
    settings: {
      throttling: {
        maxInstantPerItem: false,
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: 0
      },
      host: 'host',
      port: 1433,
      connectionTimeout: 1_000,
      database: 'database',
      username: 'oibus',
      password: 'pass',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5_000
    },
    items: [
      {
        id: 'southItemId3',
        name: 'item3',
        enabled: true,
        settings: {} as SouthItemSettings,
        scanModeId: scanModes[0].id
      }
    ]
  },
  {
    id: 'southId3',
    name: 'South 3',
    type: 'opcua',
    description: 'my OPCUA south connector',
    enabled: true,
    settings: {
      throttling: {
        maxInstantPerItem: false,
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: 10
      },
      sharedConnection: false,
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      authentication: {
        type: 'none'
      },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'southItemId4',
        name: 'opcua ha',
        enabled: true,
        settings: {
          mode: 'ha'
        } as SouthItemSettings,
        scanModeId: scanModes[0].id
      },
      {
        id: 'southItemId5',
        name: 'opcua sub',
        enabled: true,
        settings: {
          mode: 'da'
        } as SouthItemSettings,
        scanModeId: 'subscription'
      },
      {
        id: 'southItemId6',
        name: 'opcua da',
        enabled: true,
        settings: {
          mode: 'da'
        } as SouthItemSettings,
        scanModeId: scanModes[1].id
      },
      {
        id: 'southItemId7',
        name: 'opcua ha 2',
        enabled: true,
        settings: {
          mode: 'ha'
        } as SouthItemSettings,
        scanModeId: scanModes[0].id
      }
    ]
  }
];
const southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
  name: 'South 1',
  type: 'folder-scanner',
  description: 'my folder scanner',
  enabled: true,
  settings: {
    inputFolder: 'input',
    compression: true
  },
  items: [
    {
      id: 'newSouthItemFromConnectorId',
      name: 'my new item from south connector',
      enabled: true,
      settings: {
        regex: '*',
        minAge: 100,
        preserveFiles: true,
        ignoreModifiedDate: false
      },
      scanModeId: scanModes[1].id,
      scanModeName: null
    }
  ]
};
const southConnectorItemCommand: SouthConnectorItemCommandDTO<SouthItemSettings> = {
  id: 'newSouthItemId',
  name: 'New South Item',
  scanModeId: 'scanModeId1',
  scanModeName: null,
  enabled: true,
  settings: {
    regex: '*',
    minAge: 100,
    preserveFiles: true,
    ignoreModifiedDate: false
  }
};
const itemTestingSettings: SouthConnectorItemTestingSettings = {
  history: {
    startTime: constants.dates.DATE_1,
    endTime: constants.dates.DATE_2
  }
};

const northTestManifest: NorthConnectorManifest = {
  id: 'console',
  category: 'debug',
  types: ['any', 'time-values'],
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.north.settings',
    displayProperties: {
      visible: true,
      wrapInBox: true
    },
    enablingConditions: [],
    validators: [],
    attributes: []
  }
};
const northConnectors: Array<NorthConnectorEntity<NorthSettings>> = [
  {
    id: 'northId1',
    name: 'North 1',
    type: 'file-writer',
    description: 'my file writer',
    enabled: true,
    settings: {
      outputFolder: 'output-folder',
      prefix: 'prefix-',
      suffix: '-suffix'
    },
    caching: {
      trigger: {
        scanModeId: scanModes[0].id,
        numberOfElements: 250,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 30,
        maxNumberOfElements: 10_000
      },
      error: {
        retryInterval: 1_000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 72
      }
    },
    subscriptions: [
      {
        id: southConnectors[0].id,
        name: southConnectors[0].name,
        type: southConnectors[0].type,
        description: southConnectors[0].description,
        enabled: southConnectors[0].enabled
      },
      {
        id: southConnectors[1].id,
        name: southConnectors[1].name,
        type: southConnectors[1].type,
        description: southConnectors[1].description,
        enabled: southConnectors[1].enabled
      }
    ],
    transformers: [
      { transformer: transformers[0], options: {}, inputType: transformers[0].inputType },
      { transformer: transformers[1], options: {}, inputType: transformers[1].inputType }
    ]
  },
  {
    id: 'northId2',
    name: 'North 2',
    type: 'oianalytics',
    description: 'my oianalytics',
    enabled: false,
    settings: {
      useOiaModule: true,
      timeout: 5_000,
      compress: true
    },
    caching: {
      trigger: {
        scanModeId: scanModes[1].id,
        numberOfElements: 1_000,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 30,
        maxNumberOfElements: 10_000
      },
      error: {
        retryInterval: 1_000,
        retryCount: 1,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 72
      }
    },
    subscriptions: [
      {
        id: southConnectors[0].id,
        name: southConnectors[0].name,
        type: southConnectors[0].type,
        description: southConnectors[0].description,
        enabled: southConnectors[0].enabled
      }
    ],
    transformers: []
  }
];
const northConnectorCommand: NorthConnectorCommandDTO<NorthSettings> = {
  name: 'North 1',
  type: 'file-writer',
  description: 'my file writer',
  enabled: true,
  settings: {
    outputFolder: 'output-folder',
    prefix: 'prefix-',
    suffix: '-suffix'
  },
  caching: {
    trigger: {
      scanModeId: scanModes[0].id,
      scanModeName: null,
      numberOfElements: 1_000,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10_000
    },
    error: {
      retryInterval: 1_000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  },
  subscriptions: [southConnectors[0].id],
  transformers: [
    { transformerId: transformers[0].id, options: {}, inputType: transformers[0].inputType },
    { transformerId: transformers[1].id, options: {}, inputType: transformers[1].inputType }
  ]
};

const historyQueries: Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> = [
  {
    id: 'historyId1',
    name: 'my first History Query',
    description: 'description',
    status: 'RUNNING',
    startTime: '2020-02-01T02:02:59.999Z',
    endTime: '2020-02-02T02:02:59.999Z',
    southType: 'mssql',
    northType: 'oianalytics',
    southSettings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: 0
      },
      host: 'host',
      port: 1433,
      connectionTimeout: 1_000,
      database: 'database',
      username: 'oibus',
      password: 'pass',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5_000
    },
    northSettings: {
      useOiaModule: true,
      timeout: 5_000,
      compress: true
    },
    caching: {
      trigger: {
        scanModeId: scanModes[0].id,
        numberOfElements: 100,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 10_000,
        maxNumberOfElements: 1_000
      },
      error: {
        retryInterval: 1_000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: true,
        retentionDuration: 1_000
      }
    },
    items: [
      {
        id: 'historyQueryItem1',
        name: 'item1',
        enabled: true,
        settings: {} as SouthItemSettings
      },
      {
        id: 'historyQueryItem2',
        name: 'item2',
        enabled: true,
        settings: {} as SouthItemSettings
      }
    ],
    northTransformers: [
      { transformer: transformers[0], options: {}, inputType: transformers[0].inputType },
      { transformer: transformers[1], options: {}, inputType: transformers[1].inputType }
    ]
  },
  {
    id: 'historyId2',
    name: 'My second History Query',
    description: 'description',
    status: 'PENDING',
    startTime: '2020-02-01T02:02:59.999Z',
    endTime: '2020-02-02T02:02:59.999Z',
    southType: 'mssql',
    northType: 'file-writer',
    southSettings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: 10
      },
      host: 'host',
      port: 1433,
      connectionTimeout: 1_000,
      database: 'database',
      username: 'oibus',
      password: 'pass',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5_000
    },
    northSettings: {
      outputFolder: 'output-folder',
      prefix: 'prefix-',
      suffix: '-suffix'
    },
    caching: {
      trigger: {
        scanModeId: scanModes[0].id,
        numberOfElements: 100,
        numberOfFiles: 0
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 10_000,
        maxNumberOfElements: 1_000
      },
      error: {
        retryInterval: 1_000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: true,
        retentionDuration: 1_000
      }
    },
    items: [
      {
        id: 'historyQueryItem3',
        name: 'item3',
        enabled: true,
        settings: {} as SouthItemSettings
      }
    ],
    northTransformers: []
  }
];
const historyQueryCommand: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
  name: 'name',
  description: 'description',
  startTime: '2020-02-01T02:02:59.999Z',
  endTime: '2020-02-02T02:02:59.999Z',
  southType: 'mssql',
  northType: 'file-writer',
  southSettings: {
    throttling: {
      maxReadInterval: 3600,
      readDelay: 200,
      overlap: 10
    },
    host: 'host',
    port: 1433,
    connectionTimeout: 1_000,
    database: 'database',
    username: 'oibus',
    password: 'pass',
    domain: 'domain',
    encryption: true,
    trustServerCertificate: true,
    requestTimeout: 5_000
  },
  northSettings: {
    outputFolder: 'output-folder',
    prefix: 'prefix-',
    suffix: '-suffix'
  },
  caching: {
    trigger: {
      scanModeId: scanModes[0].id,
      scanModeName: null,
      numberOfElements: 1_000,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10_000
    },
    error: {
      retryInterval: 1_000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  },
  items: [
    {
      id: 'historyQueryItem4',
      name: 'item4',
      enabled: true,
      settings: {} as SouthItemSettings
    }
  ],
  northTransformers: [
    { transformerId: transformers[0].id, options: {}, inputType: transformers[0].inputType },
    { transformerId: transformers[1].id, options: {}, inputType: transformers[1].inputType }
  ]
};
const historyQueryItemCommand: HistoryQueryItemCommandDTO<SouthItemSettings> = {
  id: 'newHistoryQueryItemId',
  name: 'New History query Item',
  enabled: true,
  settings: {} as SouthItemSettings
};

const engineSettings: EngineSettings = {
  id: 'oibusId1',
  name: 'OIBus',
  port: 2223,
  version: '3.4.9',
  launcherVersion: '3.4.9',
  proxyEnabled: true,
  proxyPort: 9000,
  logParameters: {
    console: {
      level: 'info'
    },
    file: {
      level: 'info',
      maxFileSize: 50,
      numberOfFiles: 5
    },
    database: {
      level: 'info',
      maxNumberOfLogs: 100_000
    },
    loki: {
      level: 'info',
      interval: 60,
      address: 'http://localhost:8080',
      username: '',
      password: 'test'
    },
    oia: {
      level: 'info',
      interval: 10
    }
  }
};
const engineSettingsCommand: EngineSettingsCommandDTO = {
  name: 'updated OIBus',
  port: 2223,
  proxyEnabled: true,
  proxyPort: 9000,
  logParameters: {
    console: {
      level: 'silent'
    },
    file: {
      level: 'info',
      maxFileSize: 50,
      numberOfFiles: 5
    },
    database: {
      level: 'info',
      maxNumberOfLogs: 100_000
    },
    loki: {
      level: 'silent',
      interval: 60,
      address: '',
      username: '',
      password: ''
    },
    oia: {
      level: 'silent',
      interval: 10
    }
  }
};
const engineMetrics: EngineMetrics = {
  metricsStart: '2020-01-01T00:00:00.000',
  processCpuUsageInstant: 0,
  processCpuUsageAverage: 0.0000002,
  processUptime: 10000,
  freeMemory: 2_000_000,
  totalMemory: 16_000_000,
  minRss: 5,
  currentRss: 5,
  maxRss: 5,
  minHeapTotal: 5,
  currentHeapTotal: 5,
  maxHeapTotal: 5,
  minHeapUsed: 5,
  currentHeapUsed: 5,
  maxHeapUsed: 5,
  minExternal: 5,
  currentExternal: 5,
  maxExternal: 5,
  minArrayBuffers: 5,
  currentArrayBuffers: 5,
  maxArrayBuffers: 5
};
const oIBusInfo: OIBusInfo = {
  version: engineSettings.version,
  launcherVersion: engineSettings.launcherVersion,
  oibusName: engineSettings.name,
  oibusId: engineSettings.id,
  dataDirectory: 'data-directory',
  binaryDirectory: 'binary-directory',
  processId: 'pid',
  hostname: 'host name',
  operatingSystem: 'win',
  architecture: 'x64',
  platform: 'Windows Server'
};

const southMetrics: SouthConnectorMetrics = {
  metricsStart: constants.dates.DATE_1,
  lastConnection: null,
  lastRunStart: null,
  lastRunDuration: null,
  numberOfValuesRetrieved: 11,
  numberOfFilesRetrieved: 11,
  lastValueRetrieved: null,
  lastFileRetrieved: null
};
const northMetrics: NorthConnectorMetrics = {
  metricsStart: constants.dates.DATE_1,
  lastConnection: null,
  lastRunStart: null,
  lastRunDuration: null,
  contentSentSize: 11,
  contentCachedSize: 22,
  contentErroredSize: 23,
  contentArchivedSize: 24,
  lastContentSent: null,
  currentCacheSize: 10,
  currentErrorSize: 20,
  currentArchiveSize: 30
};
const historyQueryMetrics: HistoryQueryMetrics = {
  metricsStart: constants.dates.DATE_1,
  south: {
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    numberOfValuesRetrieved: 11,
    numberOfFilesRetrieved: 11,
    lastValueRetrieved: null,
    lastFileRetrieved: null
  },
  north: {
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    contentSentSize: 11,
    contentCachedSize: 22,
    contentErroredSize: 23,
    contentArchivedSize: 24,
    lastContentSent: null,
    currentCacheSize: 10,
    currentErrorSize: 20,
    currentArchiveSize: 30
  },
  historyMetrics: {
    running: false,
    intervalProgress: 0,
    currentIntervalStart: null,
    currentIntervalEnd: null,
    currentIntervalNumber: 0,
    numberOfIntervals: 0
  }
};

const logs: Array<OIBusLog> = [
  {
    timestamp: constants.dates.DATE_1,
    level: 'debug',
    scopeType: 'south',
    scopeId: southConnectors[0].id,
    scopeName: southConnectors[0].name,
    message: 'debug message log'
  },
  {
    timestamp: constants.dates.DATE_2,
    level: 'error',
    scopeType: 'south',
    scopeId: southConnectors[0].id,
    scopeName: southConnectors[0].name,
    message: 'error message log'
  },
  {
    timestamp: constants.dates.DATE_1,
    level: 'info',
    scopeType: 'north',
    scopeId: northConnectors[1].id,
    scopeName: northConnectors[1].name,
    message: 'info message log'
  },
  {
    timestamp: constants.dates.DATE_1,
    level: 'warn',
    scopeType: 'internal',
    scopeId: null,
    scopeName: null,
    message: 'warn message log'
  }
];
const logCommand: LogStreamCommandDTO = {
  streams: [
    {
      values: [['1000000', 'message1']],
      stream: {
        level: 'trace',
        oibus: 'oibusId',
        oibusName: 'oibusName',
        scopeType: 'scopeType',
        scopeId: 'scopeId',
        scopeName: 'scopeName'
      }
    },
    {
      values: [['1000001', 'message2']],
      stream: {
        level: 'debug',
        oibus: 'oibusId',
        oibusName: 'oibusName',
        scopeType: 'scopeType',
        scopeId: 'scopeId',
        scopeName: 'scopeName'
      }
    },
    {
      values: [['1000002', 'message3']],
      stream: {
        level: 'info',
        oibus: 'oibusId',
        oibusName: 'oibusName',
        scopeType: 'scopeType',
        scopeId: 'scopeId',
        scopeName: 'scopeName'
      }
    },
    {
      values: [['1000003', 'message4']],
      stream: {
        level: 'warn',
        oibus: 'oibusId',
        oibusName: 'oibusName',
        scopeType: 'scopeType',
        scopeId: 'scopeId',
        scopeName: 'scopeName'
      }
    },
    {
      values: [['1000004', 'message5']],
      stream: {
        level: 'error',
        oibus: 'oibusId',
        oibusName: 'oibusName',
        scopeType: 'scopeType',
        scopeId: 'scopeId',
        scopeName: 'scopeName'
      }
    }
  ]
};

const oIAnalyticsRegistrationRegistered: OIAnalyticsRegistration = {
  id: 'registrationId1',
  host: 'http://localhost:4200',
  activationCode: '123ABC',
  token: 'token',
  publicCipherKey: 'public key',
  privateCipherKey: 'private key',
  status: 'REGISTERED',
  checkUrl: '',
  activationExpirationDate: constants.dates.DATE_1,
  activationDate: constants.dates.DATE_2,
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: null,
  proxyUsername: null,
  proxyPassword: null,
  commandRefreshInterval: 10,
  commandRetryInterval: 5,
  messageRetryInterval: 5,
  commandPermissions: {
    updateVersion: true,
    restartEngine: true,
    regenerateCipherKeys: true,
    updateEngineSettings: true,
    updateRegistrationSettings: true,
    createScanMode: true,
    updateScanMode: true,
    deleteScanMode: true,
    createIpFilter: true,
    updateIpFilter: true,
    deleteIpFilter: true,
    createCertificate: true,
    updateCertificate: true,
    deleteCertificate: true,
    createHistoryQuery: true,
    updateHistoryQuery: true,
    deleteHistoryQuery: true,
    createOrUpdateHistoryItemsFromCsv: true,
    testHistoryNorthConnection: true,
    testHistorySouthConnection: true,
    testHistorySouthItem: true,
    createSouth: true,
    updateSouth: true,
    deleteSouth: true,
    testSouthConnection: true,
    testSouthItem: true,
    createOrUpdateSouthItemsFromCsv: true,
    createNorth: true,
    updateNorth: true,
    deleteNorth: true,
    testNorthConnection: true
  }
};
const oIAnalyticsRegistrationPending: OIAnalyticsRegistration = {
  id: 'registrationId1',
  host: 'http://localhost:4200',
  activationCode: '123ABC',
  token: '',
  publicCipherKey: '',
  privateCipherKey: '',
  status: 'PENDING',
  checkUrl: '/check/url',
  activationExpirationDate: constants.dates.DATE_1,
  activationDate: '',
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: '',
  proxyUsername: '',
  proxyPassword: '',
  commandRefreshInterval: 10,
  commandRetryInterval: 5,
  messageRetryInterval: 5,
  commandPermissions: {
    updateVersion: true,
    restartEngine: true,
    regenerateCipherKeys: true,
    updateEngineSettings: true,
    updateRegistrationSettings: true,
    createScanMode: true,
    updateScanMode: true,
    deleteScanMode: true,
    createIpFilter: true,
    updateIpFilter: true,
    deleteIpFilter: true,
    createCertificate: true,
    updateCertificate: true,
    deleteCertificate: true,
    createHistoryQuery: true,
    updateHistoryQuery: true,
    deleteHistoryQuery: true,
    createOrUpdateHistoryItemsFromCsv: true,
    testHistoryNorthConnection: true,
    testHistorySouthConnection: true,
    testHistorySouthItem: true,
    createSouth: true,
    updateSouth: true,
    deleteSouth: true,
    testSouthConnection: true,
    testSouthItem: true,
    createOrUpdateSouthItemsFromCsv: true,
    createNorth: true,
    updateNorth: true,
    deleteNorth: true,
    testNorthConnection: true
  }
};
const oIAnalyticsRegistrationCommand: OIAnalyticsRegistrationEditCommand = {
  host: 'http://localhost:4200',
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: null,
  proxyUsername: null,
  proxyPassword: null,
  commandRefreshInterval: 10,
  commandRetryInterval: 5,
  messageRetryInterval: 5,
  commandPermissions: {
    updateVersion: true,
    restartEngine: true,
    regenerateCipherKeys: true,
    updateEngineSettings: true,
    updateRegistrationSettings: true,
    createScanMode: true,
    updateScanMode: true,
    deleteScanMode: true,
    createIpFilter: true,
    updateIpFilter: true,
    deleteIpFilter: true,
    createCertificate: true,
    updateCertificate: true,
    deleteCertificate: true,
    createHistoryQuery: true,
    updateHistoryQuery: true,
    deleteHistoryQuery: true,
    createOrUpdateHistoryItemsFromCsv: true,
    testHistoryNorthConnection: true,
    testHistorySouthConnection: true,
    testHistorySouthItem: true,
    createSouth: true,
    updateSouth: true,
    deleteSouth: true,
    testSouthConnection: true,
    testSouthItem: true,
    createOrUpdateSouthItemsFromCsv: true,
    createNorth: true,
    updateNorth: true,
    deleteNorth: true,
    testNorthConnection: true
  }
};

const oIBusCommands: Array<OIBusCommand> = [
  {
    id: 'commandId1',
    type: 'update-version',
    status: 'RUNNING',
    targetVersion: engineSettings.version,
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    commandContent: {
      version: 'v3.5.0-beta',
      assetId: 'assetId',
      backupFolders: 'cache/*',
      updateLauncher: false
    }
  },
  {
    id: 'commandId2',
    type: 'update-engine-settings',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: engineSettings.version,
    commandContent: engineSettingsCommand
  },
  {
    id: 'commandId3',
    type: 'restart-engine',
    status: 'RETRIEVED',
    targetVersion: engineSettings.version,
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok'
  },
  {
    id: 'commandId4',
    type: 'update-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    scanModeId: 'scanModeId1',
    targetVersion: engineSettings.version,
    commandContent: scanModeCommandDTO
  },
  {
    id: 'commandId5',
    type: 'update-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    southConnectorId: 'southId1',
    targetVersion: engineSettings.version,
    commandContent: southConnectorCommand
  },
  {
    id: 'commandId6',
    type: 'update-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    northConnectorId: 'northId1',
    targetVersion: engineSettings.version,
    commandContent: northConnectorCommand
  },
  {
    id: 'commandId7',
    type: 'delete-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    scanModeId: 'scanModeId1',
    targetVersion: engineSettings.version
  },
  {
    id: 'commandId8',
    type: 'delete-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    southConnectorId: 'southId1',
    targetVersion: engineSettings.version
  },
  {
    id: 'commandId9',
    type: 'delete-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    northConnectorId: 'northId1',
    targetVersion: engineSettings.version
  },
  {
    id: 'commandId10',
    type: 'create-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: engineSettings.version,
    commandContent: scanModeCommandDTO
  },
  {
    id: 'commandId11',
    type: 'create-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: engineSettings.version,
    southConnectorId: null,
    commandContent: southConnectorCommand
  },
  {
    id: 'commandId12',
    type: 'create-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: engineSettings.version,
    northConnectorId: null,
    commandContent: northConnectorCommand
  },
  {
    id: 'commandId13',
    type: 'regenerate-cipher-keys',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: engineSettings.version
  },
  {
    id: 'commandId14',
    type: 'regenerate-cipher-keys',
    status: 'RETRIEVED',
    targetVersion: engineSettings.version,
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok'
  },
  {
    id: 'commandId15',
    type: 'create-or-update-south-items-from-csv',
    status: 'RETRIEVED',
    targetVersion: engineSettings.version,
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    southConnectorId: 'southId1',
    commandContent: {
      deleteItemsNotPresent: false,
      csvContent: '',
      delimiter: ','
    }
  },
  {
    id: 'newCommandId16',
    type: 'update-registration-settings',
    status: 'RETRIEVED',
    targetVersion: engineSettings.version,
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    commandContent: {
      commandRefreshInterval: 15,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true
      }
    }
  }
];
const oIAnalyticsCommands: Array<OIAnalyticsFetchCommandDTO> = [
  {
    id: 'newCommandId1',
    type: 'update-version',
    targetVersion: engineSettings.version,
    version: 'v3.5.0-beta',
    assetId: 'assetId',
    backupFoldersPattern: 'cache/*',
    updateLauncher: false
  },
  {
    id: 'newCommandId2',
    type: 'update-engine-settings',
    targetVersion: engineSettings.version,
    commandContent: engineSettingsCommand
  },
  {
    id: 'newCommandId3',
    type: 'restart-engine',
    targetVersion: engineSettings.version
  },
  {
    id: 'newCommandId4',
    type: 'update-scan-mode',
    scanModeId: 'scanModeId1',
    targetVersion: engineSettings.version,
    commandContent: scanModeCommandDTO
  },
  {
    id: 'newCommandId5',
    type: 'update-south',
    southConnectorId: 'southId1',
    targetVersion: engineSettings.version,
    commandContent: southConnectorCommand
  },
  {
    id: 'newCommandId6',
    type: 'update-north',
    northConnectorId: 'northId1',
    targetVersion: engineSettings.version,
    commandContent: northConnectorCommand
  },
  {
    id: 'newCommandId7',
    type: 'delete-scan-mode',
    scanModeId: 'scanModeId1',
    targetVersion: engineSettings.version
  },
  {
    id: 'newCommandId8',
    type: 'delete-south',
    southConnectorId: 'southId1',
    targetVersion: engineSettings.version
  },
  {
    id: 'newCommandId9',
    type: 'delete-north',
    northConnectorId: 'northId1',
    targetVersion: engineSettings.version
  },
  {
    id: 'newCommandId10',
    type: 'regenerate-cipher-keys',
    targetVersion: engineSettings.version
  },
  {
    id: 'newCommandId11',
    type: 'create-or-update-south-items-from-csv',
    targetVersion: engineSettings.version,
    southConnectorId: southConnectors[0].id,
    deleteItemsNotPresent: false,
    csvContent: '',
    delimiter: ','
  },
  {
    id: 'newCommandId12',
    type: 'create-south',
    retrieveSecretsFromSouth: 'southId1',
    targetVersion: engineSettings.version,
    commandContent: southConnectorCommand
  },
  {
    id: 'newCommandId13',
    type: 'create-north',
    retrieveSecretsFromNorth: 'northId1',
    targetVersion: engineSettings.version,
    commandContent: northConnectorCommand
  },
  {
    id: 'newCommandId14',
    type: 'update-registration-settings',
    targetVersion: engineSettings.version,
    commandContent: {
      commandRefreshInterval: 15,
      commandRetryInterval: 5,
      messageRetryInterval: 5
    }
  }
];
const oIBusMessages: Array<OIAnalyticsMessage> = [
  {
    id: 'messageId1',
    status: 'PENDING',
    error: null,
    completedDate: null,
    type: 'full-config'
  },
  {
    id: 'messageId2',
    status: 'PENDING',
    error: null,
    completedDate: null,
    type: 'full-config'
  }
];

const oibusContent: Array<OIBusContent> = [
  {
    type: 'time-values',
    content: [
      {
        pointId: 'reference1',
        timestamp: constants.dates.DATE_1,
        data: {
          value: 'value1'
        }
      },
      {
        pointId: 'reference1',
        timestamp: constants.dates.DATE_2,
        data: {
          value: 'value2',
          quality: 'good'
        }
      },
      {
        pointId: 'reference2',
        timestamp: constants.dates.DATE_3,
        data: {
          value: 'value1'
        }
      }
    ]
  },
  {
    type: 'any',
    filePath: 'path/file.csv'
  },
  {
    type: 'any',
    filePath: 'path/another-file.csv',
    content: 'my raw content'
  }
];

export default Object.freeze({
  oibusContent,
  engine: {
    settings: engineSettings,
    crypto: {
      algorithm: 'aes-256-cbc',
      initVector: 'init-vector',
      securityKey: 'security-key'
    },
    command: engineSettingsCommand,
    metrics: engineMetrics,
    oIBusInfo
  },
  oIAnalytics: {
    registration: {
      completed: oIAnalyticsRegistrationRegistered,
      pending: oIAnalyticsRegistrationPending,
      command: oIAnalyticsRegistrationCommand
    },
    commands: {
      oIBusList: oIBusCommands,
      oIAnalyticsList: oIAnalyticsCommands
    },
    messages: {
      oIBusList: oIBusMessages
    }
  },
  ipFilters: {
    list: ipFilters,
    command: ipFilterCommandDTO
  },
  scanMode: {
    list: scanModes,
    command: scanModeCommandDTO
  },
  transformers: {
    list: transformers,
    command: transformerCommandDTO
  },
  north: {
    list: northConnectors,
    command: northConnectorCommand,
    manifest: northTestManifest,
    metrics: northMetrics
  },
  south: {
    list: southConnectors,
    command: southConnectorCommand,
    itemCommand: southConnectorItemCommand,
    itemTestingSettings,
    manifest: southTestManifest,
    metrics: southMetrics
  },
  historyQueries: {
    list: historyQueries,
    command: historyQueryCommand,
    itemCommand: historyQueryItemCommand,
    metrics: historyQueryMetrics
  },
  users: {
    list: users,
    command: userCommand
  },
  certificates: {
    list: certificates,
    command: certificateCommand
  },
  logs: {
    list: logs,
    command: logCommand
  },
  constants
});
