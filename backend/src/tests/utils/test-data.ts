import { ScanMode } from '../../model/scan-mode.model';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { SubscriptionDTO } from '../../../../shared/model/subscription.model';
import { Subscription } from '../../model/subscription.model';

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
const scanModesDTO: Array<ScanModeDTO> = [
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
const subscriptionsDTO: Array<SubscriptionDTO> = [
  {
    southId: 'southId1',
    southType: 'folder-scanner',
    southName: 'South 1'
  },
  {
    southId: 'southId2',
    southType: 'mssql',
    southName: 'South 2'
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

export default Object.freeze({
  scanMode: {
    list: scanModes,
    dto: scanModesDTO,
    command: scanModeCommandDTO
  },
  subscriptions: {
    list: subscriptions,
    dto: subscriptionsDTO
  },
  north: {
    list: northConnectors
  },
  south: {
    list: southConnectors
  }
});
