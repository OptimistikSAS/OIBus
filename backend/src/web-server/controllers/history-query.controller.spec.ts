import HistoryQueryConnectorController from './history-query.controller';

import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { HistoryQueryCommandDTO, HistoryQueryCreateCommandDTO } from '../../../../shared/model/history-query.model';
import {
  NorthArchiveSettings,
  NorthCacheSettingsDTO,
  NorthConnectorCommandDTO,
  NorthConnectorDTO
} from '../../../../shared/model/north-connector.model';
import { SouthConnectorCommandDTO, SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import csv from 'papaparse';
import fs from 'node:fs/promises';
import { southTestManifest } from '../../tests/__mocks__/south-service.mock';
import { northTestManifest } from '../../tests/__mocks__/north-service.mock';
import { historyQuerySchema } from './validators/oibus-validation-schema';
import { TransformerDTO, TransformerFilterDTO } from '../../../../shared/model/transformer.model';

jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('./validators/joi.validator');

let ctx = new KoaContextMock();
const validator = new JoiValidator();
const historyQueryController = new HistoryQueryConnectorController(validator, historyQuerySchema);

const southConnectorCommand: SouthConnectorCommandDTO = {
  type: 'south-test',
  settings: {
    field: 'value'
  }
} as SouthConnectorCommandDTO;
const southConnector: SouthConnectorDTO = {
  id: 'southId',
  name: 'name',
  type: 'south-test',
  description: 'description',
  enabled: true,
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0,
    overlap: 0
  },
  settings: {
    field: 'value'
  }
};

const northCacheSettings: NorthCacheSettingsDTO = {
  scanModeId: 'scanModeId',
  retryInterval: 1000,
  retryCount: 3,
  groupCount: 100,
  maxSendCount: 1000,
  sendFileImmediately: false,
  maxSize: 10000
};
const northArchiveSettings: NorthArchiveSettings = {
  enabled: true,
  retentionDuration: 1000
};

const northConnectorCommand: NorthConnectorCommandDTO = {
  type: 'north-test',
  settings: {
    field: 'value'
  }
} as NorthConnectorCommandDTO;
const northConnector: NorthConnectorDTO = {
  id: 'northId',
  name: 'name',
  type: 'north-test',
  description: 'description',
  enabled: true,
  settings: {
    field: 'value'
  },
  caching: northCacheSettings,
  archive: northArchiveSettings
};

const historyQueryCommand: HistoryQueryCommandDTO = {
  name: 'name',
  description: 'description',
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0,
    overlap: 0
  },
  startTime: '2020-02-01T02:02:59.999Z',
  endTime: '2020-02-02T02:02:59.999Z',
  southType: 'south-test',
  northType: 'north-test',
  southSettings: {
    key: 'value'
  },
  southSharedConnection: false,
  northSettings: {
    key: 'value'
  },
  caching: northCacheSettings,
  archive: northArchiveSettings
};
const historyQueryCreateCommand: HistoryQueryCreateCommandDTO = {
  historyQuery: historyQueryCommand,
  items: [{} as SouthConnectorItemDTO],
  fromSouthId: null,
  fromNorthId: null
};
const historyQuery = {
  id: 'id',
  ...historyQueryCommand
};

const oibusItemCommand = {
  name: 'name',
  settings: {
    field: 'value'
  },
  scanModeId: ''
};
const oibusItem = {
  id: 'id',
  connectorId: 'connectorId',
  enabled: true,
  ...oibusItemCommand
};
const page = {
  content: [oibusItem],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};
const nowDateString = '2020-02-02T02:02:02.222Z';
const transformer: TransformerDTO = {
  id: 'transformerId',
  name: 'Transformer',
  description: 'Transformer description',
  code: 'code',
  inputType: 'time-values',
  outputType: 'values',
  fileRegex: null
};

describe('History query controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    ctx = new KoaContextMock();
  });

  it('getHistoryQueries() should return history queries', async () => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQueries.mockReturnValue([historyQuery]);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await historyQueryController.getHistoryQueries(ctx);

    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(1, historyQuery.southSettings, southTestManifest.settings);
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(2, historyQuery.northSettings, northTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([historyQuery]);
  });

  const invalidHistoryQueries = [
    {
      ...historyQuery,
      southType: 'invalid'
    },
    {
      ...historyQuery,
      northType: 'invalid'
    },
    {
      ...historyQuery,
      southType: 'invalid',
      northType: 'invalid'
    }
  ];
  it.each(invalidHistoryQueries)(`getHistoryQueries() should return null when manifest not found`, async invalidHistoryQuery => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQueries.mockReturnValue([historyQuery, invalidHistoryQuery]);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await historyQueryController.getHistoryQueries(ctx);
    expect(ctx.ok).toHaveBeenCalledWith([historyQuery, null]);
  });

  it('getHistoryQuery() should return history query', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await historyQueryController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(1, historyQuery.southSettings, southTestManifest.settings);
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(2, historyQuery.northSettings, northTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith(historyQuery);
  });

  it('getHistoryQuery() should return not found when history query is not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);

    await historyQueryController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it.each(invalidHistoryQueries)('getHistoryQuery() should return not found when history manifest not found', async invalidHistoryQuery => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(invalidHistoryQuery);

    await historyQueryController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQuery() should create History query with new connectors', async () => {
    ctx.request.body = {
      ...JSON.parse(JSON.stringify(historyQueryCreateCommand))
    };
    ctx.request.body.items = [
      {
        name: 'name',
        enabled: true,
        connectorId: 'connectorId',
        settings: {}
      }
    ];
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValueOnce({}).mockReturnValueOnce({});
    ctx.app.reloadService.onCreateHistoryQuery.mockReturnValue(historyQuery);

    await historyQueryController.createHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).not.toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.southSettings,
      undefined,
      southManifest.settings
    );
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.northSettings,
      undefined,
      northManifest.settings
    );
    expect(ctx.app.reloadService.onCreateHistoryQuery).toHaveBeenCalledWith(
      {
        name: 'name',
        description: 'description',
        history: southConnector.history,
        startTime: '2020-02-01T02:02:59.999Z',
        endTime: '2020-02-02T02:02:59.999Z',
        southType: 'south-test',
        northType: 'north-test',
        southSettings: {},
        southSharedConnection: false,
        northSettings: {},
        caching: northCacheSettings,
        archive: northArchiveSettings
      },
      ctx.request.body.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
  });

  it('createHistoryQuery() should create History query with new connectors with scanModeName', async () => {
    ctx.request.body = {
      ...JSON.parse(JSON.stringify(historyQueryCreateCommand))
    };
    ctx.request.body.items = [
      {
        name: 'name',
        enabled: true,
        connectorId: 'connectorId',
        settings: {}
      }
    ];
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValueOnce({}).mockReturnValueOnce({});
    ctx.app.reloadService.onCreateHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.scanModeRepository.getScanModes.mockReturnValue([
      {
        id: 'scanModeId',
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);
    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'scanModeName';

    await historyQueryController.createHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.southSettings,
      undefined,
      southManifest.settings
    );
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.northSettings,
      undefined,
      northManifest.settings
    );
    expect(ctx.app.reloadService.onCreateHistoryQuery).toHaveBeenCalledWith(
      {
        name: 'name',
        description: 'description',
        history: southConnector.history,
        startTime: '2020-02-01T02:02:59.999Z',
        endTime: '2020-02-02T02:02:59.999Z',
        southType: 'south-test',
        northType: 'north-test',
        southSettings: {},
        southSharedConnection: false,
        northSettings: {},
        caching: { ...northCacheSettings, scanModeName: 'scanModeName' },
        archive: northArchiveSettings
      },
      ctx.request.body.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
  });

  it('createHistoryQuery() should fail to create History query without scanModeName', async () => {
    ctx.request.body = {
      ...JSON.parse(JSON.stringify(historyQueryCreateCommand))
    };
    ctx.request.body.items = [
      {
        name: 'name',
        enabled: true,
        connectorId: 'connectorId',
        settings: {}
      }
    ];
    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'bad scan mode';
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValueOnce({}).mockReturnValueOnce({});
    ctx.app.reloadService.onCreateHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.scanModeRepository.getScanModes.mockReturnValue([
      {
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);

    await historyQueryController.createHistoryQuery(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode bad scan mode not found`);

    ctx.request.body.historyQuery.caching.scanModeName = '';
    await historyQueryController.createHistoryQuery(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode not specified`);
  });

  it('createHistoryQuery() should create History query with duplicate', async () => {
    ctx.request.body = {
      ...JSON.parse(JSON.stringify(historyQueryCreateCommand))
    };
    ctx.request.body.items = [
      {
        name: 'name',
        enabled: true,
        connectorId: 'connectorId',
        settings: {},
        scanModeId: 'scanModeId'
      }
    ];
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValueOnce({}).mockReturnValueOnce({});
    ctx.app.reloadService.onCreateHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.query.duplicateId = 'duplicateId';

    await historyQueryController.createHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).not.toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.southSettings,
      historyQuery.southSettings,
      southManifest.settings
    );
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.northSettings,
      historyQuery.northSettings,
      northManifest.settings
    );
    expect(ctx.app.reloadService.onCreateHistoryQuery).toHaveBeenCalledWith(
      {
        name: 'name',
        description: 'description',
        history: southConnector.history,
        startTime: '2020-02-01T02:02:59.999Z',
        endTime: '2020-02-02T02:02:59.999Z',
        southType: 'south-test',
        northType: 'north-test',
        southSettings: {},
        southSharedConnection: false,
        northSettings: {},
        caching: northCacheSettings,
        archive: northArchiveSettings
      },
      ctx.request.body.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
    ctx.query.duplicateId = null;
  });

  it('createHistoryQuery() should not create History query and return not found because of duplicate', async () => {
    ctx.request.body = {
      ...JSON.parse(JSON.stringify(historyQueryCreateCommand))
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null);
    ctx.query.duplicateId = 'bad';

    await historyQueryController.createHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.created).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('createHistoryQuery() should create History query with existing connectors', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)), fromNorthId: 'id1', fromSouthId: 'id2' };
    ctx.request.body.items = [
      {
        name: 'name',
        enabled: true,
        connectorId: 'connectorId',
        settings: {}
      }
    ];
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValue([]);
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    ctx.app.encryptionService.encryptConnectorSecrets
      .mockReturnValueOnce(southConnector.settings)
      .mockReturnValueOnce(northConnector.settings);
    ctx.app.reloadService.onCreateHistoryQuery.mockReturnValue(historyQuery);

    await historyQueryController.createHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).not.toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQuery.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQuery.northSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQuery.southSettings,
      southConnector.settings,
      southManifest.settings
    );
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQuery.northSettings,
      northConnector.settings,
      northManifest.settings
    );
    expect(ctx.app.reloadService.onCreateHistoryQuery).toHaveBeenCalledWith(
      {
        name: 'name',
        description: 'description',
        history: {
          maxInstantPerItem: true,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0
        },
        startTime: '2020-02-01T02:02:59.999Z',
        endTime: '2020-02-02T02:02:59.999Z',
        southType: 'south-test',
        northType: 'north-test',
        southSettings: southConnector.settings,
        southSharedConnection: false,
        northSettings: northConnector.settings,
        caching: northCacheSettings,
        archive: northArchiveSettings
      },
      ctx.request.body.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
  });

  it('createHistoryQuery() should not create History query without body', async () => {
    ctx.request.body = null;
    await historyQueryController.createHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createHistoryQuery() should not create History query without name or description', async () => {
    ctx.request.body = null;
    await historyQueryController.createHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createHistoryQuery() should return 404 when North connector not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)), fromNorthId: 'id1' };

    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValue([]);
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await historyQueryController.createHistoryQuery(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQuery() should return 404 when South connector not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)), fromSouthId: 'id1' };

    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValue([]);

    await historyQueryController.createHistoryQuery(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQuery() should return 404 when North manifest not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)) };
    ctx.request.body.historyQuery.northType = 'bad type';

    await historyQueryController.createHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('createHistoryQuery() should return 404 when South manifest not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)) };
    ctx.request.body.historyQuery.southType = 'bad type';

    await historyQueryController.createHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('createHistoryQuery() should return bad request when validation fails', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)) };

    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.createHistoryQuery(ctx);
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, historyQuery.southSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('startHistoryQuery() should enable History query', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);

    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.app.reloadService.onStartHistoryQuery).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('startHistoryQuery() should throw badRequest if fail to enable', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);

    ctx.app.reloadService.onStartHistoryQuery.mockImplementation(() => {
      throw new Error('bad');
    });

    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('startHistoryQuery() should return not found if history not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);

    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.app.reloadService.onStartHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('startHistoryQuery() should restart when the history is in finished or errored state', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';

    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue({ ...historyQuery, status: 'FINISHED' });
    await historyQueryController.startHistoryQuery(ctx);

    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue({ ...historyQuery, status: 'ERRORED' });
    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.app.reloadService.onRestartHistoryQuery).toHaveBeenCalledTimes(2);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('pauseHistoryQuery() should pause History query', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);

    await historyQueryController.pauseHistoryQuery(ctx);

    expect(ctx.app.reloadService.onPauseHistoryQuery).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('pauseHistoryQuery() should throw badRequest if fail to enable', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);

    ctx.app.reloadService.onPauseHistoryQuery.mockImplementation(() => {
      throw new Error('bad');
    });

    await historyQueryController.pauseHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('stopHistoryQuery() should return not found if history not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);

    await historyQueryController.pauseHistoryQuery(ctx);

    expect(ctx.app.reloadService.onPauseHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateHistoryQuery() should update History Query', async () => {
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      resetCache: true,
      items: [],
      itemIdsToDelete: ['id1']
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.encryptionService.encryptConnectorSecrets
      .mockReturnValueOnce(historyQuery.southSettings)
      .mockReturnValueOnce(historyQuery.southSettings);

    await historyQueryController.updateHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.southSettings,
      historyQuery.southSettings,
      southManifest.settings
    );
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.northSettings,
      historyQuery.northSettings,
      northManifest.settings
    );
    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('id', 'id1', false);

    expect(ctx.app.reloadService.onUpdateHistoryQuerySettings).toHaveBeenCalledWith('id', historyQueryCommand, true);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateHistoryQuery() should update History Query with scanModeName', async () => {
    ctx.request.body = {
      historyQuery: { ...JSON.parse(JSON.stringify(historyQueryCreateCommand.historyQuery)) },
      items: [
        {
          name: 'name',
          enabled: true,
          connectorId: 'connectorId',
          settings: {}
        }
      ],
      itemIdsToDelete: ['id1'],
      resetCache: true
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.encryptionService.encryptConnectorSecrets
      .mockReturnValueOnce(historyQuery.southSettings)
      .mockReturnValueOnce(historyQuery.southSettings);
    ctx.app.repositoryService.scanModeRepository.getScanModes.mockReturnValue([
      {
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);
    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'scanModeName';

    await historyQueryController.updateHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.southSettings,
      historyQuery.southSettings,
      southManifest.settings
    );
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      historyQueryCommand.northSettings,
      historyQuery.northSettings,
      northManifest.settings
    );
    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('id', 'id1', false);

    expect(ctx.app.reloadService.onUpdateHistoryQuerySettings).toHaveBeenCalledWith('id', ctx.request.body.historyQuery, true);
    expect(ctx.noContent).toHaveBeenCalled();

    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'bad scan mode';
    await historyQueryController.updateHistoryQuery(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode bad scan mode not found`);

    ctx.request.body.historyQuery.caching.scanModeName = '';
    await historyQueryController.updateHistoryQuery(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode not specified`);
  });

  it('updateHistoryQuery() should throw 404 when South manifest not found', async () => {
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue({ ...historyQuery, southType: 'invalid' });

    await historyQueryController.updateHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('updateHistoryQuery() should throw 404 when North manifest not found', async () => {
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue({ ...historyQuery, northType: 'invalid' });

    await historyQueryController.updateHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('updateHistoryQuery() should return bad request when validation fails', async () => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.updateHistoryQuery(ctx);
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, historyQueryCommand.southSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateHistoryQuery() should return not found when history query is not found', async () => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';

    await historyQueryController.updateHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateHistoryQuery() should return bad request if empty history query', async () => {
    ctx.request.body = {
      historyQuery: null,
      items: []
    };
    ctx.params.id = 'id';

    await historyQueryController.updateHistoryQuery(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('deleteHistoryQuery() should delete history query', async () => {
    ctx.params.id = 'id';

    await historyQueryController.deleteHistoryQuery(ctx);

    expect(ctx.app.reloadService.onDeleteHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteHistoryQuery() should delete history query', async () => {
    ctx.params.id = 'id';

    await historyQueryController.deleteHistoryQuery(ctx);

    expect(ctx.app.reloadService.onDeleteHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('searchSouthItems() should return South items', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.repositoryService.historyQueryItemRepository.searchHistoryItems.mockReturnValue(page);

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.searchHistoryItems).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchSouthItems() should return South items with default search params', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.params.southId = 'id';
    ctx.query = {};
    const searchParams = {
      page: 0,
      name: null
    };
    ctx.app.repositoryService.historyQueryItemRepository.searchHistoryItems.mockReturnValue(page);

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.searchHistoryItems).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('listItems() should return all items', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItems.mockReturnValue([oibusItem]);

    await historyQueryController.listItems(ctx);
    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItems).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith([oibusItem]);
  });

  it('getHistoryItem() should return item', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem.mockReturnValue(oibusItem);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith(oibusItem);
  });

  it('getHistoryItem() should return not found when South item not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem.mockReturnValue(null);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQueryItem() should create item', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = {
      ...oibusItemCommand
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.reloadService.onCreateHistoryItem.mockReturnValue(oibusItem);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onCreateHistoryItem).toHaveBeenCalledWith('historyId', oibusItemCommand);
    expect(ctx.created).toHaveBeenCalledWith(oibusItem);
  });

  it('createHistoryQueryItem() should not create item when no body provided', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = null;
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);

    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad body');
    });
    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, undefined);
    expect(ctx.app.reloadService.onCreateHistoryItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad body');
  });

  it('createHistoryQueryItem() should throw 404 when History connector not found', async () => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
  });

  it('createHistoryQueryItem() should throw 404 when South manifest not found', async () => {
    ctx.request.body = {
      ...oibusItemCommand
    };
    const invalidHistory = {
      ...historyQuery,
      southType: 'invalid'
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(invalidHistory);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryItem).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('createHistoryQueryItem() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...oibusItemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onCreateHistoryItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateHistoryQueryItem() should update item', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.params.id = 'id';
    ctx.request.body = {
      ...oibusItemCommand
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem.mockReturnValue(oibusItem);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('id');

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).toHaveBeenCalledWith('historyId', oibusItem, oibusItemCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateHistoryQueryItem() should not create item when no body provided', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = null;
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem.mockReturnValue(oibusItem);

    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad body');
    });
    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, undefined);
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad body');
  });

  it('updateHistoryQueryItem() should throw 404 when History query not found', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
  });

  it('updateHistoryQueryItem() should throw 404 when manifest not found', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = {
      ...oibusItemCommand
    };
    const invalidHistoryQuery = {
      ...historyQuery,
      southType: 'invalid'
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(invalidHistoryQuery);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'History query South manifest not found');
  });

  it('updateHistoryQueryItem() should return not found when History query South item is not found', async () => {
    ctx.params.id = 'id';
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = null;
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem.mockReturnValue(null);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateHistoryQueryItem() should return bad request when validation fails', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.params.id = 'id';
    ctx.request.body = {
      ...oibusItemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem.mockReturnValue(oibusItem);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteHistoryQueryItem() should delete South item', async () => {
    ctx.params.id = 'id';
    ctx.params.historyQueryId = 'historyId';

    await historyQueryController.deleteHistoryQueryItem(ctx);

    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('historyId', 'id', true);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableHistoryQueryItem() should enable History item', async () => {
    ctx.params.id = 'id';
    ctx.params.historyQueryId = 'historyId';

    await historyQueryController.enableHistoryQueryItem(ctx);

    expect(ctx.app.reloadService.onEnableHistoryItem).toHaveBeenCalledWith('historyId', 'id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableHistoryQueryItem() should disable History item', async () => {
    ctx.params.id = 'id';
    ctx.params.historyQueryId = 'historyId';

    await historyQueryController.disableHistoryQueryItem(ctx);

    expect(ctx.app.reloadService.onDisableHistoryItem).toHaveBeenCalledWith('historyId', 'id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllItems() should delete all South items', async () => {
    ctx.params.historyQueryId = 'id';

    await historyQueryController.deleteAllItems(ctx);

    expect(ctx.app.reloadService.onDeleteAllHistoryItems).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('historySouthItemsToCsv() should download a csv file', async () => {
    ctx.request.body = {
      items: [
        oibusItem,
        {
          name: 'item2',
          scanModeId: '',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    await historyQueryController.historySouthItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith([
      {
        name: 'name',
        enabled: true,
        settings_field: 'value'
      },
      {
        name: 'item2',
        enabled: true,
        settings_objectArray: '[]',
        settings_objectSettings: '{}',
        settings_objectValue: 1
      }
    ]);
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItems.mockReturnValueOnce([
      oibusItem,
      {
        id: 'id2',
        name: 'item2',
        scanModeId: '',
        enabled: true,
        settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
      }
    ]);
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    await historyQueryController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith(
      [
        {
          name: 'name',
          enabled: true,
          settings_field: 'value'
        },
        {
          name: 'item2',
          enabled: true,
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ],
      { columns: ['name', 'enabled', 'settings_field', 'settings_objectSettings', 'settings_objectArray', 'settings_objectValue'] }
    );
  });

  it('checkImportSouthItems() should check import of items in a csv file with new history', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.historyQueryId = 'create';

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('validation fail');
      })
      .mockImplementationOnce(() => {
        throw new Error('validation fail');
      })
      .mockImplementationOnce(() => {
        return true;
      });
    (csv.parse as jest.Mock).mockReturnValue({
      data: [
        {
          name: 'item1',
          enabled: 'false'
        },
        {
          name: 'item2',
          enabled: 'true',
          settings_badField: 'badField'
        },
        {
          name: 'item3',
          enabled: 'true',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'item4',
          enabled: 'true',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ]
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).toHaveBeenCalledTimes(3);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.ok).toHaveBeenCalledWith({
      items: [
        {
          id: '',
          name: 'item4',
          connectorId: '',
          enabled: true,
          scanModeId: '',
          settings: {
            objectArray: [],
            objectSettings: {},
            objectValue: 1
          }
        }
      ],
      errors: [
        {
          item: {
            id: '',
            name: 'item1',
            enabled: false,
            connectorId: '',
            scanModeId: '',
            settings: {}
          },
          message: 'validation fail'
        },
        {
          item: {
            id: '',
            name: 'item2',
            enabled: true,
            connectorId: '',
            scanModeId: '',
            settings: {}
          },
          message: 'Settings "badField" not accepted in manifest'
        },
        {
          item: {
            id: '',
            name: 'item3',
            enabled: true,
            connectorId: '',
            scanModeId: '',
            settings: {
              objectArray: [],
              objectSettings: {},
              objectValue: 1
            }
          },
          message: 'validation fail'
        }
      ]
    });
  });

  it('checkImportSouthItems() should check import of items in a csv file with existing history', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.historyQueryId = 'historyId';
    ctx.app.repositoryService.historyQueryItemRepository.getHistoryItems.mockReturnValueOnce([{ id: 'id1', name: 'existingItem' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      return true;
    });
    (csv.parse as jest.Mock).mockReturnValue({
      data: [
        {
          name: 'existingItem',
          enabled: 'true',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'newItem',
          enabled: 'true',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ]
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.ok).toHaveBeenCalledWith({
      items: [
        {
          id: '',
          name: 'newItem',
          connectorId: 'historyId',
          enabled: true,
          scanModeId: '',
          settings: {
            objectArray: [],
            objectSettings: {},
            objectValue: 1
          }
        }
      ],
      errors: [
        {
          item: {
            id: '',
            name: 'existingItem',
            enabled: true,
            connectorId: 'historyId',
            scanModeId: '',
            settings: {
              objectArray: [],
              objectSettings: {},
              objectValue: 1
            }
          },
          message: 'Item name "existingItem" already used'
        }
      ]
    });
  });

  it('checkImportSouthItems() should throw not found connector', async () => {
    ctx.params.southType = 'id';
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);

    await historyQueryController.checkImportSouthItems(ctx);

    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledTimes(1);
  });

  it('checkImportSouthItems() should throw badRequest when file not parsed', async () => {
    ctx.params.southType = 'south-test';
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockImplementationOnce(() => {
      throw new Error('parsing error');
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('parsing error');
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('importSouthItems() should throw not found if connector not found', async () => {
    ctx.params.historyId = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);
    await historyQueryController.importSouthItems(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
  });

  it('importSouthItems() should throw not found if connector not found', async () => {
    ctx.params.historyId = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([]);
    await historyQueryController.importSouthItems(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('importSouthItems() should throw error on validation fail', async () => {
    ctx.params.historyId = 'id';
    ctx.request.body = {
      items: [
        oibusItem,
        {
          id: 'id2',
          name: 'item2',
          scanModeId: '',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      throw new Error('validation fail');
    });
    await historyQueryController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('validation fail');
  });

  it('importSouthItems() should throw error on creation fail', async () => {
    ctx.params.historyId = 'id';
    ctx.request.body = {
      items: [
        {
          id: 'id2',
          connectorId: 'connectorId',
          name: 'item2',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateHistoryQueryItems.mockImplementation(() => {
      throw new Error('onCreateOrUpdateHistoryQueryItems error');
    });
    await historyQueryController.importSouthItems(ctx);
    expect(validator.validateSettings).toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('onCreateOrUpdateHistoryQueryItems error');
  });

  it('importSouthItems() should import items', async () => {
    ctx.params.historyId = 'id';
    ctx.request.body = {
      items: [
        {
          id: 'id2',
          connectorId: 'connectorId',
          name: 'item2',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateHistoryQueryItems.mockImplementation(() => {
      return true;
    });
    await historyQueryController.importSouthItems(ctx);
    expect(validator.validateSettings).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('testSouthConnection() should test South connector settings', async () => {
    const createdSouth = {
      testConnection: jest.fn()
    };
    ctx.request.body = southConnectorCommand;
    ctx.params.id = 'historyId';

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      historyQueryCommand.southSettings,
      southTestManifest.settings
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should test South connector settings from duplicate', async () => {
    const createdSouth = {
      testConnection: jest.fn()
    };
    ctx.request.body = southConnectorCommand;
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'duplicateId';

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('duplicateId');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      historyQueryCommand.southSettings,
      southTestManifest.settings
    );
    expect(ctx.noContent).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testSouthConnection() should test South connector and throw not found because of duplicate', async () => {
    const createdSouth = {
      testConnection: jest.fn()
    };
    ctx.request.body = southConnectorCommand;
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'bad';

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('bad');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testSouthConnection() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand,
      type: 'invalid'
    };

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('testSouthConnection() should return 404 when south connector is not found', async () => {
    ctx.params.id = 'create';
    ctx.request = {
      body: southConnectorCommand,
      query: { fromConnectorId: 'fromSouthId' }
    };
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.southService.getSouth.mockReturnValueOnce(null).mockReturnValueOnce({ settings: null });

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
    await historyQueryController.testSouthConnection(ctx);
    expect(ctx.notFound).toHaveBeenCalledTimes(2);
  });

  it('testSouthConnection() should return 404 when History query is not found', async () => {
    ctx.params.id = 'id';
    ctx.request = {
      body: southConnectorCommand,
      query: { fromConnectorId: 'fromSouthId' }
    };
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null).mockReturnValueOnce({ southSettings: null });

    await historyQueryController.testSouthConnection(ctx);
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
    await historyQueryController.testSouthConnection(ctx);
    expect(ctx.notFound).toHaveBeenCalledTimes(2);
  });

  it('testSouthConnection() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('testSouthConnection() should return bad request when validation fails', async () => {
    ctx.request.body = southConnectorCommand;
    ctx.params.id = 'historyId';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('testNorthConnection() should test North connector settings', async () => {
    const createdNorth = {
      testConnection: jest.fn()
    };
    ctx.request = { body: northConnectorCommand };
    ctx.params.id = 'historyId';

    ctx.app.northService.getInstalledNorthManifests.mockReturnValue([northTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      historyQueryCommand.northSettings,
      northTestManifest.settings
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should test North connector settings from duplicate', async () => {
    const createdNorth = {
      testConnection: jest.fn()
    };
    ctx.request.body = northConnectorCommand;
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'duplicateId';

    ctx.app.northService.getInstalledNorthManifests.mockReturnValue([northTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('duplicateId');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      historyQueryCommand.northSettings,
      northTestManifest.settings
    );
    expect(ctx.noContent).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testNorthConnection() should test North connector and throw not found because of duplicate', async () => {
    const createdNorth = {
      testConnection: jest.fn()
    };
    ctx.request.body = northConnectorCommand;
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'bad';

    ctx.app.northService.getInstalledNorthManifests.mockReturnValue([northTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('bad');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testNorthConnection() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...northConnectorCommand,
      type: 'invalid'
    };

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('testNorthConnection() should return 404 when North connector is not found', async () => {
    ctx.params.id = 'create';
    ctx.request = {
      body: northConnectorCommand,
      query: { fromConnectorId: 'fromNorthId' }
    };
    ctx.app.northService.getInstalledNorthManifests.mockReturnValue([northTestManifest]);
    ctx.app.northService.getNorth.mockReturnValueOnce(null).mockReturnValueOnce({ settings: null });

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.notFound).toHaveBeenCalledTimes(2);
  });

  it('testNorthConnection() should return 404 when History query is not found', async () => {
    ctx.params.id = 'id';
    ctx.request = {
      body: northConnectorCommand,
      query: { fromConnectorId: 'fromNorthId' }
    };
    ctx.app.northService.getInstalledNorthManifests.mockReturnValue([northTestManifest]);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null).mockReturnValueOnce({ northSettings: null });

    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.notFound).toHaveBeenCalledTimes(2);
  });

  it('testNorthConnection() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('testNorthConnection() should return bad request when validation fails', async () => {
    ctx.request.body = northConnectorCommand;
    ctx.params.id = 'historyId';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it.each(['south', 'north'] as const)('addTransformer() should add a transformer to the %s connector', async connectorType => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
    ctx.params.historyQueryId = 'historyId';
    ctx.params.transformerId = 'transformerId';

    await historyQueryController.addTransformer(ctx, connectorType);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.historyTransformerRepository.addTransformer).toHaveBeenCalledWith(
      'historyId',
      connectorType,
      'transformerId'
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it.each(['south', 'north'] as const)(
    'addTransformer() should not add a transformer to the %s connector when history query is not found',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);
      ctx.params.historyQueryId = 'historyId';

      await historyQueryController.addTransformer(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.transformerRepository.getTransformer).not.toHaveBeenCalled();
      expect(ctx.app.repositoryService.historyTransformerRepository.addTransformer).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
    }
  );

  it.each(['south', 'north'] as const)(
    'addTransformer() should not add a transformer to the %s connector when transformer is not found',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
      ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(null);
      ctx.params.historyQueryId = 'historyId';
      ctx.params.transformerId = 'transformerId';

      await historyQueryController.addTransformer(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
      expect(ctx.app.repositoryService.historyTransformerRepository.addTransformer).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(ctx.throw).toHaveBeenCalledWith(404, 'Transformer not found');
    }
  );

  it.each(['south', 'north'] as const)(
    'addTransformer() should not add transformer to the %s connector when error is thrown',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
      ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
      ctx.app.repositoryService.historyTransformerRepository.addTransformer.mockImplementationOnce(() => {
        throw new Error('SQL Duplicate key constraint failed');
      });
      ctx.params.historyQueryId = 'historyId';
      ctx.params.transformerId = 'transformerId';

      await historyQueryController.addTransformer(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
      expect(ctx.app.repositoryService.historyTransformerRepository.addTransformer).toHaveBeenCalledWith(
        'historyId',
        connectorType,
        'transformerId'
      );
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(ctx.badRequest).toHaveBeenCalledWith('SQL Duplicate key constraint failed');
    }
  );

  it.each(['south', 'north'] as const)('getTransformers() should return transformers added to the %s connector', async connectorType => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyTransformerRepository.getTransformers.mockReturnValue([transformer]);
    ctx.params.historyQueryId = 'historyId';
    const filter = {};

    await historyQueryController.getTransformers(ctx, connectorType);
    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyTransformerRepository.getTransformers).toHaveBeenCalledWith('historyId', connectorType, filter);
    expect(ctx.ok).toHaveBeenCalledWith([transformer]);
  });

  it.each(['south', 'north'] as const)(
    'getTransformers() should return transformers added to the %s connector with filters',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
      ctx.app.repositoryService.historyTransformerRepository.getTransformers.mockReturnValue([transformer]);
      ctx.params.historyQueryId = 'historyId';
      ctx.query.inputType = 'time-values';
      ctx.query.outputType = 'values';
      ctx.query.name = 'name';
      const filter: TransformerFilterDTO = {
        inputType: 'time-values',
        outputType: 'values',
        name: 'name'
      };

      await historyQueryController.getTransformers(ctx, connectorType);
      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.historyTransformerRepository.getTransformers).toHaveBeenCalledWith(
        'historyId',
        connectorType,
        filter
      );
      expect(ctx.ok).toHaveBeenCalledWith([transformer]);
    }
  );

  it.each(['south', 'north'] as const)(
    'getTransformers() should not return transformers added to the %s connector when history query is not found',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);
      ctx.params.historyQueryId = 'historyId';

      await historyQueryController.getTransformers(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.historyTransformerRepository.getTransformers).not.toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
    }
  );

  it.each(['south', 'north'] as const)(
    'getTransformers() should not return transformers added to the %s connector when error is thrown',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
      ctx.app.repositoryService.historyTransformerRepository.getTransformers.mockImplementationOnce(() => {
        throw new Error('Unexpected filter value');
      });
      ctx.params.historyQueryId = 'historyId';
      const filter = {};

      await historyQueryController.getTransformers(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.historyTransformerRepository.getTransformers).toHaveBeenCalledWith(
        'historyId',
        connectorType,
        filter
      );
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(ctx.badRequest).toHaveBeenCalledWith('Unexpected filter value');
    }
  );

  it.each(['south', 'north'] as const)('removeTransformer() should remove a transformer from the %s connector', async connectorType => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
    ctx.params.historyQueryId = 'historyId';
    ctx.params.transformerId = 'transformerId';

    await historyQueryController.removeTransformer(ctx, connectorType);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.historyTransformerRepository.removeTransformer).toHaveBeenCalledWith(
      'historyId',
      connectorType,
      'transformerId'
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it.each(['south', 'north'] as const)(
    'removeTransformer() should not remove a transformer from the %s connector when history query is not found',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);
      ctx.params.historyQueryId = 'historyId';

      await historyQueryController.removeTransformer(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.transformerRepository.getTransformer).not.toHaveBeenCalled();
      expect(ctx.app.repositoryService.historyTransformerRepository.removeTransformer).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
    }
  );

  it.each(['south', 'north'] as const)(
    'removeTransformer() should not remove a transformer from the %s connector when transformer is not found',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
      ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(null);
      ctx.params.historyQueryId = 'historyId';
      ctx.params.transformerId = 'transformerId';

      await historyQueryController.removeTransformer(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
      expect(ctx.app.repositoryService.historyTransformerRepository.removeTransformer).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(ctx.throw).toHaveBeenCalledWith(404, 'Transformer not found');
    }
  );

  it.each(['south', 'north'] as const)(
    'removeTransformer() should not remove a transformer from the %s connector when error is thrown',
    async connectorType => {
      ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
      ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
      ctx.app.repositoryService.historyTransformerRepository.removeTransformer.mockImplementationOnce(() => {
        throw new Error('Unexpected error occurred');
      });
      ctx.params.historyQueryId = 'historyId';
      ctx.params.transformerId = 'transformerId';

      await historyQueryController.removeTransformer(ctx, connectorType);

      expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
      expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
      expect(ctx.app.repositoryService.historyTransformerRepository.removeTransformer).toHaveBeenCalledWith(
        'historyId',
        connectorType,
        'transformerId'
      );
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(ctx.badRequest).toHaveBeenCalledWith('Unexpected error occurred');
    }
  );
});

describe('South connection tests', () => {
  const createdSouth = {
    testConnection: jest.fn()
  };
  const type = southTestManifest.id;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.southService.getSouth.mockReturnValue(southConnectorCommand);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    ctx.request = {
      body: undefined,
      query: undefined
    };
    ctx.params = {};
  });

  it('testSouthConnection() should test South connector settings with existing history query', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request.body = {
      type,
      settings: connectorSettings
    };
    ctx.params.id = 'historyId';

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      connectorSettings,
      historyQueryCommand.southSettings,
      southTestManifest.settings
    );
    expect(createdSouth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should test South connector settings for new history query with new connector', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request.body = {
      type,
      settings: connectorSettings
    };
    ctx.params.id = 'create';

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.southService.getSouth).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(connectorSettings, null, southTestManifest.settings);
    expect(createdSouth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should test South connector settings for new history query with existing connector', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: 'fromSouthId' }
    };
    ctx.params.id = 'create';

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.southService.getSouth).toHaveBeenCalledWith('fromSouthId');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      connectorSettings,
      southConnectorCommand.settings,
      southTestManifest.settings
    );
    expect(createdSouth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should test South connector settings for new history query with existing connector (wrong id)', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: null }
    };
    ctx.params.id = 'create';

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.southService.getSouth).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(connectorSettings, null, southTestManifest.settings);
    expect(createdSouth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should throw 404 when manifest not found', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request.body = { type: 'invalid', settings: connectorSettings };
    ctx.params.id = 'create';

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('testSouthConnection() should return 404 when south connector is not found', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: 'fromSouthId' }
    };
    ctx.params.id = 'create';
    ctx.app.southService.getSouth.mockReturnValueOnce(null);

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testSouthConnection() should return 404 when cannot get history query dto', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: 'fromSouthId' }
    };
    ctx.params.id = 'unknown';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null);

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testSouthConnection() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('testSouthConnection() should return bad request when validation fails', async () => {
    const connectorSettings = southConnectorCommand.settings;
    ctx.request.body = { type, settings: connectorSettings };
    ctx.params.id = 'historyId';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.testSouthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, connectorSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });
});

describe('North connection tests', () => {
  const createdNorth = {
    testConnection: jest.fn()
  };
  const type = northTestManifest.id;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    ctx.app.northService.getInstalledNorthManifests.mockReturnValue([northTestManifest]);
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQueryCommand);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.northService.getNorth.mockReturnValue(northConnectorCommand);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    ctx.request = {
      body: undefined,
      query: undefined
    };
    ctx.params = {};
  });

  it('testNorthConnection() should test North connector settings with existing history query', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request.body = {
      type,
      settings: connectorSettings
    };
    ctx.params.id = 'historyId';

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      connectorSettings,
      historyQueryCommand.northSettings,
      northTestManifest.settings
    );
    expect(createdNorth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should test North connector settings for new history query with new connector', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request.body = {
      type,
      settings: connectorSettings
    };
    ctx.params.id = 'create';

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.northService.getNorth).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(connectorSettings, null, northTestManifest.settings);
    expect(createdNorth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should test North connector settings for new history query with existing connector', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: 'fromNorthId' }
    };
    ctx.params.id = 'create';

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.northService.getNorth).toHaveBeenCalledWith('fromNorthId');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      connectorSettings,
      northConnectorCommand.settings,
      northTestManifest.settings
    );
    expect(createdNorth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should test North connector settings for new history query with existing connector (wrong id)', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: null }
    };
    ctx.params.id = 'create';

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.northService.getNorth).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(connectorSettings, null, northTestManifest.settings);
    expect(createdNorth.testConnection).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should throw 404 when manifest not found', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request.body = { type: 'invalid', settings: connectorSettings };
    ctx.params.id = 'create';

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('testNorthConnection() should return 404 when north connector is not found', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: 'fromNorthId' }
    };
    ctx.params.id = 'create';
    ctx.app.northService.getNorth.mockReturnValueOnce(null);

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testNorthConnection() should return 404 when cannot get history query dto', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request = {
      body: { type, settings: connectorSettings },
      query: { fromConnectorId: 'fromNorthId' }
    };
    ctx.params.id = 'unknown';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValueOnce(null);

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testNorthConnection() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('testNorthConnection() should return bad request when validation fails', async () => {
    const connectorSettings = northConnectorCommand.settings;
    ctx.request.body = { type, settings: connectorSettings };
    ctx.params.id = 'historyId';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, connectorSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });
});
