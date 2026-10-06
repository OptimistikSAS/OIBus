/*
 * Frontend test fixtures, shaped exactly like the REST API responses and commands (DTOs).
 * Initially generated from the backend test data through the backend's own entity -> DTO mappers; owned by the
 * frontend from then on - edit them here, the frontend must not import backend test code.
 */
import { CertificateCommandDTO, CertificateDTO } from '@oibus/shared/api/certificate.model';
import {
  EngineLoggerCommandDTO,
  EngineNameCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineWebServerCommandDTO,
  OIBusInfo,
  RegistrationSettingsCommandDTO,
  RegistrationSettingsDTO
} from '@oibus/shared/api/engine.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryLightDTO
} from '@oibus/shared/api/history-query.model';
import { IPFilterCommandDTO, IPFilterDTO } from '@oibus/shared/api/ip-filter.model';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { ScanModeCommandDTO, ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorLightDTO
} from '@oibus/shared/api/south-connector.model';
import { CustomTransformerCommandDTO, CustomTransformerDTO } from '@oibus/shared/api/transformer.model';
import { UserCommandDTO, UserDTO } from '@oibus/shared/api/user.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { EngineMetrics, HistoryQueryMetrics, NorthConnectorMetrics, SouthConnectorMetrics } from '@oibus/shared/domain/engine.model';
import { OIBusCommandDTO } from '@oibus/shared/oia/command.model';

const DATE_1 = '2020-03-15T00:00:00.000Z';

const DATE_2 = '2020-03-20T00:00:00.000Z';

const southManifest: SouthConnectorManifest = {
  id: 'folder-scanner',
  category: 'file',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: true,
    history: true
  },
  explore: true,
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
          key: 'scanMode',
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

const southList: Array<SouthConnectorDTO> = [
  {
    id: 'southId1',
    name: 'South 1',
    type: 'folder-scanner',
    description: 'my folder scanner',
    enabled: true,
    settings: {
      inputFolder: 'input',
      compression: true,
      username: null,
      password: '',
      domain: null
    },
    items: [
      {
        id: 'southItemId1',
        name: 'item1',
        enabled: true,
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { regex: '.*', minAge: 100, preserveFiles: true, maxFiles: 0, maxSize: 0, recursive: false },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: 0,
        endTimeOffset: 0,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      },
      {
        id: 'southItemId2',
        name: 'item2',
        enabled: true,
        scanMode: {
          id: 'scanModeId2',
          name: 'scanMode2',
          description: 'my second scanMode',
          type: 'cron',
          cron: '0 * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { regex: '.*', minAge: 100, preserveFiles: true, maxFiles: 0, maxSize: 0, recursive: false },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: 0,
        endTimeOffset: 0,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      }
    ],
    groups: [],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'southId2',
    name: 'South 2',
    type: 'mssql',
    description: 'my MSSQL south connector',
    enabled: false,
    settings: {
      host: 'host',
      port: 1433,
      connectionTimeout: 1000,
      database: 'database',
      username: 'oibus',
      password: '',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5000
    },
    items: [
      {
        id: 'southItemId3',
        name: 'item3',
        enabled: true,
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { query: 'SELECT * FROM logs', trackingInstant: null },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        startTimeOffset: 0,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      },
      {
        id: 'southItemId4',
        name: 'item4',
        enabled: true,
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { query: 'SELECT * FROM logs', trackingInstant: null },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        startTimeOffset: 0,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      }
    ],
    groups: [],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'southId3',
    name: 'South 3',
    type: 'opcua',
    description: 'my OPCUA south connector',
    enabled: true,
    settings: {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      maxParallelRun: 1,
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000,
      authentication: {
        type: 'none',
        password: ''
      },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'southItemId5',
        name: 'opcua ha',
        enabled: true,
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { nodeId: 'ns=3;s=Random', mode: 'ha' },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        startTimeOffset: 10,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      },
      {
        id: 'southItemId6',
        name: 'opcua sub',
        enabled: true,
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          type: 'cron',
          cron: '',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { nodeId: 'ns=3;s=Random', mode: 'da' },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        startTimeOffset: 10,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      },
      {
        id: 'southItemId7',
        name: 'opcua da',
        enabled: true,
        scanMode: {
          id: 'scanModeId2',
          name: 'scanMode2',
          description: 'my second scanMode',
          type: 'cron',
          cron: '0 * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { nodeId: 'ns=3;s=Random', mode: 'da' },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        startTimeOffset: 10,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      },
      {
        id: 'southItemId8',
        name: 'opcua ha 2',
        enabled: true,
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        settings: { nodeId: 'ns=3;s=Random', mode: 'ha' },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        startTimeOffset: 10,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null
      }
    ],
    groups: [],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const southListLight: Array<SouthConnectorLightDTO> = [
  {
    id: 'southId1',
    name: 'South 1',
    type: 'folder-scanner',
    description: 'my folder scanner',
    enabled: true,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'southId2',
    name: 'South 2',
    type: 'mssql',
    description: 'my MSSQL south connector',
    enabled: false,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'southId3',
    name: 'South 3',
    type: 'opcua',
    description: 'my OPCUA south connector',
    enabled: true,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const southCommand: SouthConnectorCommandDTO = {
  name: 'South 1',
  type: 'folder-scanner',
  description: 'my folder scanner',
  enabled: true,
  settings: {
    inputFolder: 'input',
    compression: true,
    username: null,
    password: null,
    domain: null
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
        ignoreModifiedDate: false,
        maxFiles: 0,
        maxSize: 0,
        recursive: false
      },
      scanModeId: 'scanModeId2',
      scanModeName: null,
      groupId: null,
      groupName: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: 0,
      endTimeOffset: 0,
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null
    }
  ],
  groups: [],
  configurationWorkflows: []
};

const southItemCommand: SouthConnectorItemCommandDTO = {
  id: 'newSouthItemId',
  name: 'New South Item',
  scanModeId: 'scanModeId1',
  scanModeName: null,
  enabled: true,
  settings: {
    regex: '*',
    minAge: 100,
    preserveFiles: true,
    ignoreModifiedDate: false,
    maxFiles: 0,
    maxSize: 0,
    recursive: false
  },
  groupId: null,
  groupName: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: 0,
  endTimeOffset: 0,
  recoveryStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null
};

const southMetrics: SouthConnectorMetrics = {
  metricsStart: '2020-03-15T00:00:00.000Z',
  lastConnection: null,
  lastRunStart: null,
  lastRunDuration: null,
  numberOfValuesRetrieved: 11,
  numberOfFilesRetrieved: 11,
  lastValueRetrieved: null,
  lastFileRetrieved: null
};

const northManifest: NorthConnectorManifest = {
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

const northList: Array<NorthConnectorDTO> = [
  {
    id: 'northId1',
    name: 'North 1',
    type: 'file-writer',
    description: 'my file writer',
    enabled: true,
    settings: {
      outputFolder: 'output-folder',
      prefix: 'prefix-',
      suffix: '-suffix',
      username: null,
      password: '',
      domain: null
    },
    caching: {
      trigger: {
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        numberOfElements: 250,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 30,
        maxNumberOfElements: 10000
      },
      error: {
        retryInterval: 1000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 72
      }
    },
    transformers: [
      {
        id: 'northTransformerId1',
        transformer: {
          id: 'transformerId1',
          type: 'custom',
          name: 'my transformer 1',
          description: 'description',
          inputType: 'time-values',
          outputType: 'any',
          customCode: 'console.log("Hello World");',
          language: 'javascript',
          manifest: {
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
          },
          timeout: 2000,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        options: {},
        source: {
          type: 'south',
          south: {
            id: 'southId1',
            name: 'South 1',
            type: 'folder-scanner',
            description: 'my folder scanner',
            enabled: true,
            createdBy: {
              id: '',
              friendlyName: ''
            },
            updatedBy: {
              id: '',
              friendlyName: ''
            },
            createdAt: '',
            updatedAt: ''
          },
          items: [
            {
              id: 'southItemId1',
              name: 'item1',
              enabled: true,
              createdBy: {
                id: '',
                friendlyName: ''
              },
              updatedBy: {
                id: '',
                friendlyName: ''
              },
              createdAt: '',
              updatedAt: ''
            }
          ]
        }
      },
      {
        id: 'northTransformerId2',
        transformer: {
          id: 'transformerId2',
          type: 'custom',
          name: 'my transformer 2',
          description: 'description',
          inputType: 'any',
          outputType: 'any',
          customCode: 'console.log("Hello World");',
          language: 'javascript',
          manifest: {
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
          },
          timeout: 2000,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        options: {},
        source: {
          type: 'oibus-api',
          dataSourceId: 'dataSourceId1'
        }
      },
      {
        id: 'northTransformerId3',
        transformer: {
          id: 'transformerId3',
          type: 'custom',
          name: 'my transformer 3',
          description: 'description',
          inputType: 'setpoint',
          outputType: 'any',
          customCode: 'console.log("Hello World");',
          language: 'javascript',
          manifest: {
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
          },
          timeout: 2000,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        options: {},
        source: {
          type: 'south',
          south: {
            id: 'southId2',
            name: 'South 2',
            type: 'mssql',
            description: 'my MSSQL south connector',
            enabled: false,
            createdBy: {
              id: '',
              friendlyName: ''
            },
            updatedBy: {
              id: '',
              friendlyName: ''
            },
            createdAt: '',
            updatedAt: ''
          },
          items: []
        }
      }
    ],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'northId2',
    name: 'North 2',
    type: 'oianalytics',
    description: 'my oianalytics',
    enabled: false,
    settings: {
      useOiaModule: true,
      timeout: 5000,
      compress: true
    },
    caching: {
      trigger: {
        scanMode: {
          id: 'scanModeId2',
          name: 'scanMode2',
          description: 'my second scanMode',
          type: 'cron',
          cron: '0 * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        numberOfElements: 1000,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 30,
        maxNumberOfElements: 10000
      },
      error: {
        retryInterval: 1000,
        retryCount: 1,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 72
      }
    },
    transformers: [],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const northListLight: Array<NorthConnectorLightDTO> = [
  {
    id: 'northId1',
    name: 'North 1',
    type: 'file-writer',
    description: 'my file writer',
    enabled: true,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'northId2',
    name: 'North 2',
    type: 'oianalytics',
    description: 'my oianalytics',
    enabled: false,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const northCommand: NorthConnectorCommandDTO = {
  name: 'North 1',
  type: 'file-writer',
  description: 'my file writer',
  enabled: true,
  settings: {
    outputFolder: 'output-folder',
    prefix: 'prefix-',
    suffix: '-suffix',
    username: null,
    password: null,
    domain: null
  },
  caching: {
    trigger: {
      scanModeId: 'scanModeId1',
      scanModeName: null,
      numberOfElements: 1000,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10000
    },
    error: {
      retryInterval: 1000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  },
  transformers: [
    {
      id: 'northTransformerId4',
      transformerId: 'transformerId1',
      options: {},
      source: {
        type: 'south',
        southId: 'southId1',
        items: [
          {
            id: 'southItemId1',
            name: 'item1',
            enabled: true
          }
        ]
      }
    },
    {
      id: 'northTransformerId5',
      transformerId: 'transformerId2',
      options: {},
      source: {
        type: 'oibus-api',
        dataSourceId: 'dataSourceId'
      }
    }
  ]
};

const northMetrics: NorthConnectorMetrics = {
  metricsStart: '2020-03-15T00:00:00.000Z',
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

const historyQueryList: Array<HistoryQueryDTO> = [
  {
    id: 'historyId1',
    name: 'my first History Query',
    description: 'description',
    status: 'RUNNING',
    southType: 'mssql',
    southSettings: {
      host: 'host',
      port: 1433,
      connectionTimeout: 1000,
      database: 'database',
      username: 'oibus',
      password: '',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5000
    },
    queryTimeRange: {
      startTime: '2020-03-15T00:00:00.000Z',
      endTime: '2020-03-20T00:00:00.000Z',
      maxReadInterval: 3600,
      readDelay: 200
    },
    northType: 'oianalytics',
    northSettings: {
      useOiaModule: true,
      timeout: 5000,
      compress: true
    },
    caching: {
      trigger: {
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        numberOfElements: 100,
        numberOfFiles: 1
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 10000,
        maxNumberOfElements: 1000
      },
      error: {
        retryInterval: 1000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: true,
        retentionDuration: 1000
      }
    },
    items: [
      {
        id: 'historyQueryItem1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table1',
          trackingInstant: {
            trackInstant: false
          }
        },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'historyQueryItem2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table2',
          trackingInstant: {
            trackInstant: false
          }
        },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: ''
      }
    ],
    northTransformers: [
      {
        id: 'historyTransformerId1',
        transformer: {
          id: 'transformerId1',
          type: 'custom',
          name: 'my transformer 1',
          description: 'description',
          inputType: 'time-values',
          outputType: 'any',
          customCode: 'console.log("Hello World");',
          language: 'javascript',
          manifest: {
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
          },
          timeout: 2000,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        options: {},
        items: [
          {
            id: 'historyQueryItem2',
            name: 'item2',
            enabled: true,
            createdBy: {
              id: '',
              friendlyName: ''
            },
            updatedBy: {
              id: '',
              friendlyName: ''
            },
            createdAt: '',
            updatedAt: ''
          }
        ]
      },
      {
        id: 'historyTransformerId2',
        transformer: {
          id: 'transformerId2',
          type: 'custom',
          name: 'my transformer 2',
          description: 'description',
          inputType: 'any',
          outputType: 'any',
          customCode: 'console.log("Hello World");',
          language: 'javascript',
          manifest: {
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
          },
          timeout: 2000,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        options: {},
        items: []
      }
    ],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'historyId2',
    name: 'My second History Query',
    description: 'description',
    status: 'PENDING',
    southType: 'mssql',
    southSettings: {
      host: 'host',
      port: 1433,
      connectionTimeout: 1000,
      database: 'database',
      username: 'oibus',
      password: '',
      domain: 'domain',
      encryption: true,
      trustServerCertificate: true,
      requestTimeout: 5000
    },
    queryTimeRange: {
      startTime: '2020-03-15T00:00:00.000Z',
      endTime: '2020-03-20T00:00:00.000Z',
      maxReadInterval: 3600,
      readDelay: 200
    },
    northType: 'file-writer',
    northSettings: {
      outputFolder: 'output-folder',
      prefix: 'prefix-',
      suffix: '-suffix',
      username: null,
      password: '',
      domain: null
    },
    caching: {
      trigger: {
        scanMode: {
          id: 'scanModeId1',
          name: 'scanMode1',
          description: 'my first scanMode',
          type: 'cron',
          cron: '* * * * * *',
          interval: null,
          activationWindow: null,
          activationWindowExpired: false,
          createdBy: {
            id: '',
            friendlyName: ''
          },
          updatedBy: {
            id: '',
            friendlyName: ''
          },
          createdAt: '',
          updatedAt: ''
        },
        numberOfElements: 100,
        numberOfFiles: 0
      },
      throttling: {
        runMinDelay: 200,
        maxSize: 10000,
        maxNumberOfElements: 1000
      },
      error: {
        retryInterval: 1000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: true,
        retentionDuration: 1000
      }
    },
    items: [
      {
        id: 'historyQueryItem3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table3',
          trackingInstant: {
            trackInstant: false
          }
        },
        createdBy: {
          id: '',
          friendlyName: ''
        },
        updatedBy: {
          id: '',
          friendlyName: ''
        },
        createdAt: '',
        updatedAt: ''
      }
    ],
    northTransformers: [],
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const historyQueryListLight: Array<HistoryQueryLightDTO> = [
  {
    id: 'historyId1',
    name: 'my first History Query',
    description: 'description',
    status: 'RUNNING',
    startTime: '2020-03-15T00:00:00.000Z',
    endTime: '2020-03-20T00:00:00.000Z',
    southType: 'mssql',
    northType: 'oianalytics',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'historyId2',
    name: 'My second History Query',
    description: 'description',
    status: 'PENDING',
    startTime: '2020-03-15T00:00:00.000Z',
    endTime: '2020-03-20T00:00:00.000Z',
    southType: 'mssql',
    northType: 'file-writer',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const historyQueryCommand: HistoryQueryCommandDTO = {
  name: 'name',
  description: 'description',
  queryTimeRange: {
    startTime: '2020-03-15T00:00:00.000Z',
    endTime: '2020-03-20T00:00:00.000Z',
    maxReadInterval: 3600,
    readDelay: 200
  },
  southType: 'mssql',
  northType: 'file-writer',
  southSettings: {
    host: 'host',
    port: 1433,
    connectionTimeout: 1000,
    database: 'database',
    username: 'oibus',
    password: 'pass',
    domain: 'domain',
    encryption: true,
    trustServerCertificate: true,
    requestTimeout: 5000
  },
  northSettings: {
    outputFolder: 'output-folder',
    prefix: 'prefix-',
    suffix: '-suffix',
    username: null,
    password: null,
    domain: null
  },
  caching: {
    trigger: {
      scanModeId: 'scanModeId1',
      scanModeName: null,
      numberOfElements: 1000,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10000
    },
    error: {
      retryInterval: 1000,
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
      id: 'temp_',
      name: 'item4',
      enabled: true,
      settings: {
        query: 'SELECT * FROM table4',
        trackingInstant: {
          trackInstant: false
        }
      }
    }
  ],
  northTransformers: [
    {
      id: 'historyTransformerId3',
      transformerId: 'transformerId1',
      options: {},
      items: [
        {
          id: 'temp_',
          name: 'item4',
          enabled: true
        }
      ]
    },
    {
      id: 'historyTransformerId4',
      transformerId: 'transformerId2',
      options: {},
      items: []
    }
  ]
};

const historyQueryItemCommand: HistoryQueryItemCommandDTO = {
  id: 'newHistoryQueryItemId',
  name: 'New History query Item',
  enabled: true,
  settings: {
    query: 'SELECT * FROM newTable',
    trackingInstant: {
      trackInstant: false
    }
  }
};

const historyQueryMetrics: HistoryQueryMetrics = {
  metricsStart: '2020-03-15T00:00:00.000Z',
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
    numberOfIntervals: 0,
    itemName: 'item1',
    currentItemNumber: 1,
    numberOfItems: 3,
    itemIntervalProgress: 0,
    itemIntervalNumber: 0,
    itemNumberOfIntervals: 0,
    itemsStatus: [
      {
        itemId: 'historyQueryItem1',
        itemName: 'item1',
        status: 'running',
        lastValueTimestamp: null,
        recordsCount: 0
      },
      {
        itemId: 'historyQueryItem2',
        itemName: 'item2',
        status: 'pending',
        lastValueTimestamp: null,
        recordsCount: 0
      },
      {
        itemId: 'historyQueryItem3',
        itemName: 'item3',
        status: 'pending',
        lastValueTimestamp: null,
        recordsCount: 0
      }
    ]
  }
};

const scanModeList: Array<ScanModeDTO> = [
  {
    id: 'scanModeId1',
    name: 'scanMode1',
    description: 'my first scanMode',
    type: 'cron',
    cron: '* * * * * *',
    interval: null,
    activationWindow: null,
    activationWindowExpired: false,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'scanModeId2',
    name: 'scanMode2',
    description: 'my second scanMode',
    type: 'cron',
    cron: '0 * * * * *',
    interval: null,
    activationWindow: null,
    activationWindowExpired: false,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'subscription',
    name: 'Subscription',
    description: 'Subscription',
    type: 'cron',
    cron: 'subscription',
    interval: null,
    activationWindow: null,
    activationWindowExpired: false,
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const scanModeCommand: ScanModeCommandDTO = {
  name: 'my new scan mode',
  description: 'another scan mode',
  type: 'cron',
  cron: '0 * * * * *',
  interval: null,
  activationWindow: null
};

const certificateList: Array<CertificateDTO> = [
  {
    id: 'certificate1',
    name: 'Certificate 1',
    description: '',
    publicKey: 'public key',
    certificate: 'certificate',
    certificateChain: null,
    expiry: '2020-03-15T00:00:00.000Z',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'certificate2',
    name: 'Certificate 2',
    description: '',
    publicKey: 'public key',
    certificate: 'certificate',
    certificateChain: null,
    expiry: '2020-03-20T00:00:00.000Z',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
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

const ipFilterList: Array<IPFilterDTO> = [
  {
    id: 'ipFilterId1',
    address: '192.168.1.1',
    description: 'my first ip filter',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'ipFilterId2',
    address: '*',
    description: 'All ips',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const ipFilterCommand: IPFilterCommandDTO = {
  address: '1.1.1.1',
  description: 'my first ip filter'
};

const userList: Array<UserDTO> = [
  {
    id: 'user1',
    login: 'admin',
    firstName: null,
    lastName: null,
    email: null,
    language: 'en',
    timezone: 'Europe/Paris',
    friendlyName: 'Admin',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'user2',
    login: 'secondUser',
    firstName: 'first name',
    lastName: 'last name',
    email: 'email',
    language: 'fr',
    timezone: 'Europe/Paris',
    friendlyName: 'first name last name (secondUser)',
    createdBy: {
      id: '',
      friendlyName: ''
    },
    updatedBy: {
      id: '',
      friendlyName: ''
    },
    createdAt: '',
    updatedAt: ''
  }
];

const userCommand: UserCommandDTO = {
  login: 'anotherUser',
  firstName: 'first name',
  lastName: 'last name',
  email: 'another-user@mail.com',
  language: 'en',
  timezone: 'Europe/Paris'
};

const customTransformerList: Array<CustomTransformerDTO> = [
  {
    id: 'transformerId1',
    type: 'custom',
    name: 'my transformer 1',
    description: 'description',
    inputType: 'time-values',
    outputType: 'any',
    customCode: 'console.log("Hello World");',
    language: 'javascript',
    timeout: 2000,
    manifest: {
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
    },
    createdAt: '2020-03-15T00:00:00.000Z',
    updatedAt: '2020-03-20T00:00:00.000Z',
    createdBy: {
      id: 'admin',
      friendlyName: 'Admin'
    },
    updatedBy: {
      id: 'admin',
      friendlyName: 'Admin'
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
    language: 'javascript',
    timeout: 2000,
    manifest: {
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
    },
    createdAt: '2020-03-15T00:00:00.000Z',
    updatedAt: '2020-03-20T00:00:00.000Z',
    createdBy: {
      id: 'admin',
      friendlyName: 'Admin'
    },
    updatedBy: {
      id: 'admin',
      friendlyName: 'Admin'
    }
  }
];

const transformerCommand: CustomTransformerCommandDTO = {
  type: 'custom',
  name: 'my new transformer',
  description: 'description',
  inputType: 'time-values',
  outputType: 'any',
  customCode: 'console.log("Hello World");',
  language: 'javascript',
  timeout: 2000,
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

const engineCommand: EngineSettingsCommandDTO = {
  general: {
    name: 'updated OIBus'
  },
  auditRetentionDuration: null,
  webServer: {
    port: 2223,
    authTokenDuration: '7d'
  },
  proxyServer: {
    enabled: true,
    port: 9000,
    forward: {
      enabled: false,
      url: null,
      username: null,
      password: null
    },
    username: null,
    password: null
  },
  logger: {
    auditRetentionDuration: 90,
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
      maxNumberOfLogs: 100000
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
    },
    syslog: {
      level: 'silent',
      host: '',
      port: 514,
      protocol: 'udp4'
    }
  }
};

const engineNameCommand: EngineNameCommandDTO = {
  name: 'updated OIBus'
};

const engineWebServerCommand: EngineWebServerCommandDTO = {
  port: 3333,
  authTokenDuration: '1d'
};

const engineProxyCommand: EngineProxyCommandDTO = {
  enabled: true,
  port: 9000,
  forward: {
    enabled: false,
    url: null,
    username: null,
    password: null
  },
  username: null,
  password: null
};

const engineLoggerCommand: EngineLoggerCommandDTO = {
  auditRetentionDuration: 90,
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
    maxNumberOfLogs: 100000
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
  },
  syslog: {
    level: 'silent',
    host: '',
    port: 514,
    protocol: 'udp4'
  }
};

const engineMetrics: EngineMetrics = {
  metricsStart: '2020-01-01T00:00:00.000',
  processCpuUsageInstant: 0,
  processCpuUsageAverage: 2e-7,
  processUptime: 10000,
  freeMemory: 2000000,
  totalMemory: 16000000,
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
  version: '3.4.9',
  launcherVersion: '3.4.9',
  oibusName: 'OIBus',
  oibusId: 'oibusId1',
  dataDirectory: 'data-directory',
  binaryDirectory: 'binary-directory',
  processId: 'pid',
  hostname: 'host name',
  operatingSystem: 'win',
  architecture: 'x64',
  platform: 'Windows Server',
  ignoreIpFilters: false,
  ignoreRemoteUpdate: false
};

const registrationCompleted: RegistrationSettingsDTO = {
  id: 'registrationId1',
  createdBy: {
    id: '',
    friendlyName: ''
  },
  updatedBy: {
    id: '',
    friendlyName: ''
  },
  createdAt: '',
  updatedAt: '',
  host: 'http://localhost:4200',
  activationCode: '123ABC',
  status: 'REGISTERED',
  activationDate: '2020-03-20T00:00:00.000Z',
  activationExpirationDate: '2020-03-15T00:00:00.000Z',
  checkUrl: '',
  useProxy: false,
  proxyUrl: null,
  proxyUsername: null,
  useApiGateway: false,
  apiGatewayHeaderKey: null,
  apiGatewayBaseEndpoint: null,
  acceptUnauthorized: false,
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
    createOrUpdateSouthItemsFromCsv: true,
    testSouthConnection: true,
    testSouthItem: true,
    createNorth: true,
    updateNorth: true,
    deleteNorth: true,
    testNorthConnection: true,
    setpoint: true,
    searchHistoryCacheContent: true,
    getHistoryCacheFileContent: true,
    updateHistoryCacheContent: true,
    searchNorthCacheContent: true,
    getNorthCacheFileContent: true,
    updateNorthCacheContent: true,
    createCustomTransformer: true,
    updateCustomTransformer: true,
    deleteCustomTransformer: true,
    testCustomTransformer: true
  }
};

const registrationCommand: RegistrationSettingsCommandDTO = {
  host: 'http://localhost:4200',
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: null,
  proxyUsername: null,
  proxyPassword: null,
  useApiGateway: false,
  apiGatewayHeaderKey: null,
  apiGatewayHeaderValue: null,
  apiGatewayBaseEndpoint: null,
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
    testNorthConnection: true,
    setpoint: true,
    searchHistoryCacheContent: true,
    getHistoryCacheFileContent: true,
    updateHistoryCacheContent: true,
    searchNorthCacheContent: true,
    getNorthCacheFileContent: true,
    updateNorthCacheContent: true,
    createCustomTransformer: true,
    updateCustomTransformer: true,
    deleteCustomTransformer: true,
    testCustomTransformer: true
  }
};

const oIBusCommandList: Array<OIBusCommandDTO> = [
  {
    id: 'commandId1',
    type: 'update-version',
    status: 'RUNNING',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
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
    type: 'update-engine-general',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'updated OIBus'
    }
  },
  {
    id: 'commandId3',
    type: 'restart-engine',
    status: 'RETRIEVED',
    targetVersion: '3.4.9',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok'
  },
  {
    id: 'commandId4',
    type: 'update-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    scanModeId: 'scanModeId1',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'my new scan mode',
      description: 'another scan mode',
      type: 'cron',
      cron: '0 * * * * *',
      interval: null,
      activationWindow: null
    }
  },
  {
    id: 'commandId5',
    type: 'update-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    southConnectorId: 'southId1',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'South 1',
      type: 'folder-scanner',
      description: 'my folder scanner',
      enabled: true,
      settings: {
        inputFolder: 'input',
        compression: true,
        username: null,
        password: null,
        domain: null
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
            ignoreModifiedDate: false,
            maxFiles: 0,
            maxSize: 0,
            recursive: false
          },
          scanModeId: 'scanModeId2',
          scanModeName: null,
          groupId: null,
          groupName: null,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          startTimeOffset: 0,
          endTimeOffset: 0,
          recoveryStrategy: null,
          cachingStrategy: null,
          thresholdType: null,
          threshold: null,
          rangeLow: null,
          rangeHigh: null,
          maxCachingInterval: null
        }
      ],
      groups: [],
      configurationWorkflows: []
    }
  },
  {
    id: 'commandId6',
    type: 'update-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    northConnectorId: 'northId1',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'North 1',
      type: 'file-writer',
      description: 'my file writer',
      enabled: true,
      settings: {
        outputFolder: 'output-folder',
        prefix: 'prefix-',
        suffix: '-suffix',
        username: null,
        password: null,
        domain: null
      },
      caching: {
        trigger: {
          scanModeId: 'scanModeId1',
          scanModeName: null,
          numberOfElements: 1000,
          numberOfFiles: 1
        },
        throttling: {
          runMinDelay: 200,
          maxSize: 30,
          maxNumberOfElements: 10000
        },
        error: {
          retryInterval: 1000,
          retryCount: 3,
          retentionDuration: 24
        },
        archive: {
          enabled: false,
          retentionDuration: 0
        }
      },
      transformers: [
        {
          id: 'northTransformerId4',
          transformerId: 'transformerId1',
          options: {},
          source: {
            type: 'south',
            southId: 'southId1',
            items: [
              {
                id: 'southItemId1',
                name: 'item1',
                enabled: true
              }
            ]
          }
        },
        {
          id: 'northTransformerId5',
          transformerId: 'transformerId2',
          options: {},
          source: {
            type: 'oibus-api',
            dataSourceId: 'dataSourceId'
          }
        }
      ]
    }
  },
  {
    id: 'commandId7',
    type: 'delete-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    scanModeId: 'scanModeId1',
    targetVersion: '3.4.9'
  },
  {
    id: 'commandId8',
    type: 'delete-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    southConnectorId: 'southId1',
    targetVersion: '3.4.9'
  },
  {
    id: 'commandId9',
    type: 'delete-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    northConnectorId: 'northId1',
    targetVersion: '3.4.9'
  },
  {
    id: 'commandId10',
    type: 'create-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'my new scan mode',
      description: 'another scan mode',
      type: 'cron',
      cron: '0 * * * * *',
      interval: null,
      activationWindow: null
    }
  },
  {
    id: 'commandId11',
    type: 'create-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'South 1',
      type: 'folder-scanner',
      description: 'my folder scanner',
      enabled: true,
      settings: {
        inputFolder: 'input',
        compression: true,
        username: null,
        password: null,
        domain: null
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
            ignoreModifiedDate: false,
            maxFiles: 0,
            maxSize: 0,
            recursive: false
          },
          scanModeId: 'scanModeId2',
          scanModeName: null,
          groupId: null,
          groupName: null,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          startTimeOffset: 0,
          endTimeOffset: 0,
          recoveryStrategy: null,
          cachingStrategy: null,
          thresholdType: null,
          threshold: null,
          rangeLow: null,
          rangeHigh: null,
          maxCachingInterval: null
        }
      ],
      groups: [],
      configurationWorkflows: []
    }
  },
  {
    id: 'commandId12',
    type: 'create-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    targetVersion: '3.4.9',
    commandContent: {
      name: 'North 1',
      type: 'file-writer',
      description: 'my file writer',
      enabled: true,
      settings: {
        outputFolder: 'output-folder',
        prefix: 'prefix-',
        suffix: '-suffix',
        username: null,
        password: null,
        domain: null
      },
      caching: {
        trigger: {
          scanModeId: 'scanModeId1',
          scanModeName: null,
          numberOfElements: 1000,
          numberOfFiles: 1
        },
        throttling: {
          runMinDelay: 200,
          maxSize: 30,
          maxNumberOfElements: 10000
        },
        error: {
          retryInterval: 1000,
          retryCount: 3,
          retentionDuration: 24
        },
        archive: {
          enabled: false,
          retentionDuration: 0
        }
      },
      transformers: [
        {
          id: 'northTransformerId4',
          transformerId: 'transformerId1',
          options: {},
          source: {
            type: 'south',
            southId: 'southId1',
            items: [
              {
                id: 'southItemId1',
                name: 'item1',
                enabled: true
              }
            ]
          }
        },
        {
          id: 'northTransformerId5',
          transformerId: 'transformerId2',
          options: {},
          source: {
            type: 'oibus-api',
            dataSourceId: 'dataSourceId'
          }
        }
      ]
    }
  },
  {
    id: 'commandId13',
    type: 'regenerate-cipher-keys',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    targetVersion: '3.4.9'
  },
  {
    id: 'commandId14',
    type: 'regenerate-cipher-keys',
    status: 'RETRIEVED',
    targetVersion: '3.4.9',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok'
  },
  {
    id: 'commandId15',
    type: 'create-or-update-south-items-from-csv',
    status: 'RETRIEVED',
    targetVersion: '3.4.9',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
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
    targetVersion: '3.4.9',
    ack: false,
    retrievedDate: '2020-03-15T00:00:00.000Z',
    completedDate: '',
    result: 'ok',
    commandContent: {
      commandRefreshInterval: 15,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: registrationCompleted.commandPermissions
    }
  }
];

const testData = {
  constants: { dates: { DATE_1, DATE_2 } },
  south: {
    manifest: southManifest,
    list: southList,
    listLight: southListLight,
    command: southCommand,
    itemCommand: southItemCommand,
    metrics: southMetrics
  },
  north: { manifest: northManifest, list: northList, listLight: northListLight, command: northCommand, metrics: northMetrics },
  historyQueries: {
    list: historyQueryList,
    listLight: historyQueryListLight,
    command: historyQueryCommand,
    itemCommand: historyQueryItemCommand,
    metrics: historyQueryMetrics
  },
  scanMode: { list: scanModeList, command: scanModeCommand },
  certificates: { list: certificateList, command: certificateCommand },
  ipFilters: { list: ipFilterList, command: ipFilterCommand },
  users: { list: userList, command: userCommand },
  transformers: { customList: customTransformerList, command: transformerCommand },
  engine: {
    command: engineCommand,
    nameCommand: engineNameCommand,
    webServerCommand: engineWebServerCommand,
    proxyCommand: engineProxyCommand,
    loggerCommand: engineLoggerCommand,
    metrics: engineMetrics,
    oIBusInfo
  },
  oIAnalytics: {
    registration: { completed: registrationCompleted, command: registrationCommand },
    commands: { oIBusList: oIBusCommandList }
  }
};

export default testData;
