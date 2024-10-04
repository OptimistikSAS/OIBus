import { ScanMode } from '../../model/scan-mode.model';
import { ScanModeCommandDTO } from '../../../../shared/model/scan-mode.model';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { Subscription } from '../../model/subscription.model';
import { IPFilterCommandDTO } from '../../../../shared/model/ip-filter.model';
import { IPFilter } from '../../model/ip-filter.model';
import { EngineSettings } from '../../model/engine.model';
import { EngineMetrics, EngineSettingsCommandDTO, OIBusInfo } from '../../../../shared/model/engine.model';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import { OIBusCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from '../../service/oia/oianalytics.model';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';
import { toEngineSettingsDTO } from '../../service/oibus.service';
import { toIPFilterDTO } from '../../service/ip-filter.service';
import { toScanModeDTO } from '../../service/scan-mode.service';
import { toSubscriptionDTO } from '../../service/subscription.service';
import { toOIAnalyticsRegistrationDTO } from '../../service/oia/oianalytics-registration.service';

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
};

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

const scanModeCommandDTO: ScanModeCommandDTO = {
  name: 'my new scan mode',
  description: 'another scan mode',
  cron: '0 * * * * *'
};
const scanModes: Array<ScanMode> = [
  {
    id: 'id1',
    name: 'scanMode1',
    description: 'my first scanMode',
    cron: '* * * * * *'
  },
  {
    id: 'id2',
    name: 'scanMode2',
    description: 'my second scanMode',
    cron: '0 * * * * *'
  }
];

const subscriptions: Array<Subscription> = [
  {
    south: {
      id: 'southId1',
      type: 'folder-scanner',
      name: 'South 1'
    }
  },
  {
    south: {
      id: 'southId2',
      type: 'mssql',
      name: 'South 2'
    }
  }
];

const northConnectors: Array<NorthConnectorDTO> = [
  {
    id: 'northId1',
    name: 'North 1',
    type: 'file-writer',
    description: 'my file writer',
    enabled: true,
    settings: {},
    caching: {
      scanModeId: 'id1',
      retryInterval: 1_000,
      retryCount: 3,
      maxSize: 0,
      oibusTimeValues: {
        groupCount: 1_000,
        maxSendCount: 10_000
      },
      rawFiles: {
        sendFileImmediately: true,
        archive: {
          enabled: true,
          retentionDuration: 72
        }
      }
    }
  },
  {
    id: 'northId2',
    name: 'North 2',
    type: 'oianalytics',
    description: 'my oianalytics',
    enabled: true,
    settings: {},
    caching: {
      scanModeId: 'id2',
      retryInterval: 1_000,
      retryCount: 3,
      maxSize: 0,
      oibusTimeValues: {
        groupCount: 1_000,
        maxSendCount: 10_000
      },
      rawFiles: {
        sendFileImmediately: false,
        archive: {
          enabled: false,
          retentionDuration: 72
        }
      }
    }
  }
];
const southConnectors: Array<SouthConnectorDTO> = [
  {
    id: 'southId1',
    name: 'South 1',
    type: 'folder-scanner',
    description: 'my folder scanner',
    enabled: true,
    sharedConnection: false,
    settings: {},
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 3600,
      readDelay: 200,
      overlap: 0
    }
  },
  {
    id: 'southId2',
    name: 'South 2',
    type: 'mssql',
    description: 'my MSSQL south connector',
    enabled: true,
    sharedConnection: false,
    settings: {},
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 3600,
      readDelay: 200,
      overlap: 0
    }
  }
];

const engineSettings: EngineSettings = {
  id: 'oibusId1',
  name: 'OIBus',
  port: 2223,
  version: '3.5.0',
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
const metrics: EngineMetrics = {
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

const oIAnalyticsRegistrationRegistered: OIAnalyticsRegistration = {
  id: 'registrationId1',
  host: 'http://localhost:4200',
  activationCode: '123ABC',
  token: 'token',
  status: 'REGISTERED',
  checkUrl: '',
  activationExpirationDate: constants.dates.DATE_1,
  activationDate: constants.dates.DATE_2,
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: '',
  proxyUsername: '',
  proxyPassword: ''
};
const oIAnalyticsRegistrationPending: OIAnalyticsRegistration = {
  id: 'registrationId1',
  host: 'http://localhost:4200',
  activationCode: '123ABC',
  token: '',
  status: 'PENDING',
  checkUrl: '/check/url',
  activationExpirationDate: constants.dates.DATE_1,
  activationDate: '',
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: '',
  proxyUsername: '',
  proxyPassword: ''
};
const oIAnalyticsRegistrationCommand: OIAnalyticsRegistrationEditCommand = {
  host: 'http://localhost:4200',
  acceptUnauthorized: false,
  useProxy: false,
  proxyUrl: '',
  proxyUsername: '',
  proxyPassword: ''
};

const oIBusCommands: Array<OIBusCommand> = [
  {
    id: 'commandId1',
    type: 'update-version',
    status: 'RUNNING',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    version: '3.5.0',
    assetId: 'assetId'
  },
  {
    id: 'commandId2',
    type: 'update-engine-settings',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'commandId3',
    type: 'restart-engine',
    status: 'RETRIEVED',
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
    targetVersion: 'v3.5.0',
    commandContent: {}
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
    targetVersion: 'v3.5.0',
    commandContent: {}
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
    targetVersion: 'v3.5.0',
    commandContent: {}
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
    targetVersion: 'v3.5.0'
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
    targetVersion: 'v3.5.0'
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
    targetVersion: 'v3.5.0'
  },
  {
    id: 'commandId10',
    type: 'create-scan-mode',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'commandId11',
    type: 'create-south',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'commandId12',
    type: 'create-north',
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: constants.dates.DATE_1,
    completedDate: '',
    result: 'ok',
    targetVersion: 'v3.5.0',
    commandContent: {}
  }
];
const oIAnalyticsCommands: Array<OIAnalyticsFetchCommandDTO> = [
  {
    id: 'newCommandId1',
    type: 'update-version',
    version: '3.5.0',
    assetId: 'assetId'
  },
  {
    id: 'newCommandId2',
    type: 'update-engine-settings',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'newCommandId3',
    type: 'restart-engine'
  },
  {
    id: 'newCommandId4',
    type: 'update-scan-mode',
    scanModeId: 'scanModeId1',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'newCommandId5',
    type: 'update-south',
    southConnectorId: 'southId1',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'newCommandId6',
    type: 'update-north',
    northConnectorId: 'northId1',
    targetVersion: 'v3.5.0',
    commandContent: {}
  },
  {
    id: 'newCommandId7',
    type: 'delete-scan-mode',
    scanModeId: 'scanModeId1',
    targetVersion: 'v3.5.0'
  },
  {
    id: 'newCommandId8',
    type: 'delete-south',
    southConnectorId: 'southId1',
    targetVersion: 'v3.5.0'
  },
  {
    id: 'newCommandId9',
    type: 'delete-north',
    northConnectorId: 'northId1',
    targetVersion: 'v3.5.0'
  }
];
const oIBusMessages: Array<OIAnalyticsMessage> = [
  {
    id: 'messageId1',
    status: 'PENDING',
    error: null,
    completedDate: null,
    type: 'full-config'
  }
];
export default Object.freeze({
  engine: {
    settings: engineSettings,
    crypto: {
      algorithm: 'aes-256-cbc',
      initVector: 'init-vector',
      securityKey: 'security-key'
    },
    dto: toEngineSettingsDTO(engineSettings),
    command: engineSettingsCommand,
    metrics,
    oIBusInfo
  },
  oIAnalytics: {
    registration: {
      completed: oIAnalyticsRegistrationRegistered,
      completedDto: toOIAnalyticsRegistrationDTO(oIAnalyticsRegistrationRegistered),
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
    dto: ipFilters.map(ipFilter => toIPFilterDTO(ipFilter)),
    command: ipFilterCommandDTO
  },
  scanMode: {
    list: scanModes,
    dto: scanModes.map(scanMode => toScanModeDTO(scanMode)),
    command: scanModeCommandDTO
  },
  subscriptions: {
    list: subscriptions,
    dto: subscriptions.map(subscription => toSubscriptionDTO(subscription))
  },
  north: {
    list: northConnectors
  },
  south: {
    list: southConnectors
  },
  constants
});
