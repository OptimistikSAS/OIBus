import HistoryQueryConnectorController from './history-query.controller';

import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { HistoryQueryCommandDTO, HistoryQueryCreateCommandDTO } from '../../../../shared/model/history-query.model';
import { NorthArchiveSettings, NorthCacheSettingsDTO, NorthConnectorCommandDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorCommandDTO, SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import csv from 'papaparse';
import fs from 'node:fs/promises';
import { southTestManifest } from '../../tests/__mocks__/service/south-service.mock';
import { northTestManifest } from '../../tests/__mocks__/service/north-service.mock';
import { historyQuerySchema } from './validators/oibus-validation-schema';

jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('./validators/joi.validator');

const ctx = new KoaContextMock();
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
const northArchiveSettings: NorthArchiveSettings = {
  enabled: true,
  retentionDuration: 1000
};
const northCacheSettings: NorthCacheSettingsDTO = {
  scanModeId: 'scanModeId',
  retryInterval: 1000,
  retryCount: 3,
  maxSize: 10000,
  oibusTimeValues: {
    groupCount: 100,
    maxSendCount: 1000
  },
  rawFiles: {
    archive: northArchiveSettings,
    sendFileImmediately: false
  }
};

const northConnectorCommand: NorthConnectorCommandDTO = {
  type: 'north-test',
  settings: {
    field: 'value'
  }
} as NorthConnectorCommandDTO;

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
  caching: northCacheSettings
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

describe('History query controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  it('findAll() should return history queries', async () => {
    ctx.app.repositoryService.historyQueryRepository.findAll.mockReturnValue([historyQuery]);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await historyQueryController.findAll(ctx);

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
  it.each(invalidHistoryQueries)(`findAll() should return null when manifest not found`, async invalidHistoryQuery => {
    ctx.app.repositoryService.historyQueryRepository.findAll.mockReturnValue([historyQuery, invalidHistoryQuery]);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await historyQueryController.findAll(ctx);
    expect(ctx.ok).toHaveBeenCalledWith([historyQuery, null]);
  });

  it('findById() should return history query', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await historyQueryController.findById(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(1, historyQuery.southSettings, southTestManifest.settings);
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(2, historyQuery.northSettings, northTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith(historyQuery);
  });

  it('findById() should return not found when history query is not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(null);

    await historyQueryController.findById(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it.each(invalidHistoryQueries)('findById() should return not found when history manifest not found', async invalidHistoryQuery => {
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(invalidHistoryQuery);

    await historyQueryController.findById(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should create History query with new connectors', async () => {
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

    await historyQueryController.create(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.findAll).not.toHaveBeenCalled();
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
        caching: northCacheSettings
      },
      ctx.request.body.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
  });

  it('create() should create History query with new connectors with scanModeName', async () => {
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
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValue([
      {
        id: 'scanModeId',
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);
    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'scanModeName';

    await historyQueryController.create(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.findAll).toHaveBeenCalled();
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
        caching: { ...northCacheSettings, scanModeName: 'scanModeName' }
      },
      ctx.request.body.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
  });

  it('create() should fail to create History query without scanModeName', async () => {
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
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValue([
      {
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);

    await historyQueryController.create(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode bad scan mode not found`);

    ctx.request.body.historyQuery.caching.scanModeName = '';
    await historyQueryController.create(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode not specified`);
  });

  it('create() should not create History query without body', async () => {
    ctx.request.body = null;
    await historyQueryController.create(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('create() should return 404 when North connector not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)), fromNorthId: 'id1' };

    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.northConnectorRepository.findById.mockReturnValue(null);

    await historyQueryController.create(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should return 404 when South connector not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)), fromSouthId: 'id1' };

    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);

    await historyQueryController.create(ctx);

    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should return 404 when North manifest not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)) };
    ctx.request.body.historyQuery.northType = 'bad type';

    await historyQueryController.create(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('create() should return 404 when South manifest not found', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)) };
    ctx.request.body.historyQuery.southType = 'bad type';

    await historyQueryController.create(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateHistoryQuery).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('create() should return bad request when validation fails', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)) };

    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.create(ctx);
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, historyQuery.southSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('start() should enable History query', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);

    await historyQueryController.start(ctx);

    expect(ctx.app.reloadService.onStartHistoryQuery).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('pauseHistoryQuery() should pause History query', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);

    await historyQueryController.pause(ctx);

    expect(ctx.app.reloadService.onPauseHistoryQuery).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('update() should update History Query', async () => {
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      resetCache: true,
      items: [],
      itemIdsToDelete: ['id1']
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.encryptionService.encryptConnectorSecrets
      .mockReturnValueOnce(historyQuery.southSettings)
      .mockReturnValueOnce(historyQuery.southSettings);

    await historyQueryController.update(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.findAll).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('id');
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
    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('id', 'id1');

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.encryptionService.encryptConnectorSecrets
      .mockReturnValueOnce(historyQuery.southSettings)
      .mockReturnValueOnce(historyQuery.southSettings);
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValue([
      {
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);
    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'scanModeName';

    await historyQueryController.update(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
    expect(ctx.app.repositoryService.scanModeRepository.findAll).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(southManifest.settings, historyQueryCommand.southSettings);
    expect(validator.validateSettings).toHaveBeenCalledWith(northManifest.settings, historyQueryCommand.northSettings);
    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('id');
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
    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('id', 'id1');

    expect(ctx.app.reloadService.onUpdateHistoryQuerySettings).toHaveBeenCalledWith('id', ctx.request.body.historyQuery);
    expect(ctx.app.reloadService.historyEngine.resetCache).toHaveBeenCalledTimes(1);
    expect(ctx.noContent).toHaveBeenCalled();

    ctx.request.body.historyQuery.caching.scanModeId = '';
    ctx.request.body.historyQuery.caching.scanModeName = 'bad scan mode';
    await historyQueryController.update(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode bad scan mode not found`);

    ctx.request.body.historyQuery.caching.scanModeName = '';
    await historyQueryController.update(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(`Scan mode not specified`);
  });

  it('updateHistoryQuery() should throw 404 when South manifest not found', async () => {
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue({ ...historyQuery, southType: 'invalid' });

    await historyQueryController.update(ctx);

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue({ ...historyQuery, northType: 'invalid' });

    await historyQueryController.update(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('updateHistoryQuery() should return bad request when validation fails', async () => {
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.update(ctx);
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, historyQueryCommand.southSettings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateHistoryQuery() should return not found when history query is not found', async () => {
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(null);
    ctx.request.body = {
      historyQuery: { ...historyQueryCommand },
      items: []
    };
    ctx.params.id = 'id';

    await historyQueryController.update(ctx);

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

    await historyQueryController.update(ctx);

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
    ctx.app.repositoryService.historyQueryItemRepository.search.mockReturnValue(page);

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.search).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchSouthItems() should return South items with default search params', async () => {
    ctx.params.southId = 'id';
    ctx.query = {};
    const searchParams = {
      page: 0
    };
    ctx.app.repositoryService.historyQueryItemRepository.search.mockReturnValue(page);

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.search).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('listItems() should return all items', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.list.mockReturnValue([oibusItem]);

    await historyQueryController.listItems(ctx);
    expect(ctx.app.repositoryService.historyQueryItemRepository.list).toHaveBeenCalledWith('id', {});
    expect(ctx.ok).toHaveBeenCalledWith([oibusItem]);
  });

  it('getHistoryItem() should return item', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.findById.mockReturnValue(oibusItem);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith(oibusItem);
  });

  it('getHistoryItem() should return not found when South item not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryItemRepository.findById.mockReturnValue(null);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQueryItem() should create item', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = {
      ...oibusItemCommand
    };
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.reloadService.onCreateHistoryItem.mockReturnValue(oibusItem);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onCreateHistoryItem).toHaveBeenCalledWith('historyId', oibusItemCommand);
    expect(ctx.created).toHaveBeenCalledWith(oibusItem);
  });

  it('createHistoryQueryItem() should not create item when no body provided', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = null;
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);

    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad body');
    });
    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, undefined);
    expect(ctx.app.reloadService.onCreateHistoryItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad body');
  });

  it('createHistoryQueryItem() should throw 404 when History connector not found', async () => {
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(null);

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(invalidHistory);

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onCreateHistoryItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateHistoryQueryItem() should update item', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = {
      ...oibusItemCommand
    };
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.findById.mockReturnValue(oibusItem);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).toHaveBeenCalledWith('id');

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).toHaveBeenCalledWith('historyId', oibusItem, oibusItemCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateHistoryQueryItem() should not create item when no body provided', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = null;
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.findById.mockReturnValue(oibusItem);

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(null);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).not.toHaveBeenCalled();
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(invalidHistoryQuery);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'History query South manifest not found');
  });

  it('updateHistoryQueryItem() should return not found when History query South item is not found', async () => {
    ctx.params.id = 'id';
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = null;
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.findById.mockReturnValue(null);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateHistoryQueryItem() should return bad request when validation fails', async () => {
    ctx.params.historyQueryId = 'historyId';
    ctx.request.body = {
      ...oibusItemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
    ctx.app.repositoryService.historyQueryItemRepository.findById.mockReturnValue(oibusItem);

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('historyId');
    expect(ctx.app.repositoryService.historyQueryItemRepository.findById).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onUpdateHistoryItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteHistoryQueryItem() should delete South item', async () => {
    ctx.params.id = 'id';
    ctx.params.historyQueryId = 'historyId';

    await historyQueryController.deleteHistoryQueryItem(ctx);

    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('historyId', 'id');
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
    ctx.app.repositoryService.historyQueryItemRepository.list.mockReturnValueOnce([
      oibusItem,
      {
        id: 'id2',
        name: 'item2',
        scanModeId: '',
        enabled: true,
        settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
      }
    ]);
    ctx.request.body = { delimiter: ';' };
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
      {
        columns: ['name', 'enabled', 'settings_field', 'settings_objectSettings', 'settings_objectArray', 'settings_objectValue'],
        delimiter: ';'
      }
    );
  });

  it('checkImportSouthItems() should check import of items in a csv file with new history', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.historyQueryId = 'create';

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.body = { delimiter: ',' };
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
      meta: {
        delimiter: ','
      },
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
    ctx.app.repositoryService.historyQueryItemRepository.list.mockReturnValueOnce([{ id: 'id1', name: 'existingItem' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.body = { delimiter: ',' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      return true;
    });
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: ','
      },
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

  // it('checkImportSouthItems() should reject bad file type', async () => {
  //   ctx.params.southType = 'south-test';
  //   ctx.request.file = { path: 'myFile.txt', mimetype: 'bad type' };
  //
  //   await historyQueryController.checkImportSouthItems(ctx);
  //
  //   expect(ctx.badRequest).toHaveBeenCalledTimes(1);
  //   expect(csv.parse).not.toHaveBeenCalled();
  //   expect(fs.readFile).not.toHaveBeenCalled();
  //   expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
  //   expect(ctx.noContent).not.toHaveBeenCalled();
  //   expect(ctx.throw).not.toHaveBeenCalled();
  // });

  it('checkImportSouthItems() should throw badRequest when file not parsed', async () => {
    ctx.params.southType = 'south-test';
    ctx.request.body = { delimiter: ',' };
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

  it('checkImportSouthItems() should throw badRequest when delimiter not the same in file and entered', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'create';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]', delimiter: ';' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: ','
      },
      data: []
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('The entered delimiter does not correspond to the file delimiter');
    expect(ctx.throw).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('importSouthItems() should throw not found if connector not found', async () => {
    ctx.params.historyId = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(null);
    await historyQueryController.importSouthItems(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(404, 'History query not found');
  });

  it('importSouthItems() should throw not found if connector not found', async () => {
    ctx.params.historyId = 'id';
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQuery);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('duplicateId');
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValueOnce(null);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('bad');
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValueOnce(null).mockReturnValueOnce({ southSettings: null });

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('duplicateId');
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValueOnce(null);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    await historyQueryController.testNorthConnection(ctx);
    expect(ctx.app.repositoryService.historyQueryRepository.findById).toHaveBeenCalledWith('bad');
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValueOnce(null).mockReturnValueOnce({ northSettings: null });

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await historyQueryController.testNorthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValueOnce(null);

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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValue(historyQueryCommand);
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
    ctx.app.repositoryService.historyQueryRepository.findById.mockReturnValueOnce(null);

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
