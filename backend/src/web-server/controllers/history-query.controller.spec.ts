import HistoryQueryConnectorController from './history-query.controller';

import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { HistoryQueryCommandDTO, HistoryQueryCreateCommandDTO } from '../../../../shared/model/history-query.model';
import { historyQuerySchema } from '../../engine/oibus-validation-schema';
import { NorthArchiveSettings, NorthCacheSettingsDTO, NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import csv from 'papaparse';
import fs from 'node:fs/promises';
import { southTestManifest } from '../../tests/__mocks__/south-service.mock';
import { northTestManifest } from '../../tests/__mocks__/north-service.mock';

jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('./validators/joi.validator');

const ctx = new KoaContextMock();
const validator = new JoiValidator();
const historyQueryController = new HistoryQueryConnectorController(validator, historyQuerySchema);

const southConnector: SouthConnectorDTO = {
  id: 'southId',
  name: 'name',
  type: 'south-test',
  description: 'description',
  enabled: true,
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0
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
    readDelay: 0
  },
  startTime: '2020-02-01T02:02:59.999Z',
  endTime: '2020-02-02T02:02:59.999Z',
  southType: 'south-test',
  northType: 'north-test',
  southSettings: {
    key: 'value'
  },
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

describe('History query controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
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
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(invalidHistoryQuery);

    await historyQueryController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQuery() should create History query with new connectors', async () => {
    ctx.request.body = {
      ...JSON.parse(JSON.stringify(historyQueryCreateCommand))
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValueOnce({}).mockReturnValueOnce({});
    ctx.app.reloadService.onCreateHistoryQuery.mockReturnValue(historyQuery);

    await historyQueryController.createHistoryQuery(ctx);

    const southManifest = southTestManifest;
    const northManifest = northTestManifest;
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
        northSettings: {},
        caching: northCacheSettings,
        archive: northArchiveSettings
      },
      historyQueryCreateCommand.items
    );
    expect(ctx.created).toHaveBeenCalledWith(historyQuery);
  });

  it('createHistoryQuery() should create History query with existing connectors', async () => {
    ctx.request.body = { ...JSON.parse(JSON.stringify(historyQueryCreateCommand)), fromNorthId: 'id1', fromSouthId: 'id2' };
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
          readDelay: 0
        },
        startTime: '2020-02-01T02:02:59.999Z',
        endTime: '2020-02-02T02:02:59.999Z',
        southType: 'south-test',
        northType: 'north-test',
        southSettings: southConnector.settings,
        northSettings: northConnector.settings,
        caching: northCacheSettings,
        archive: northArchiveSettings
      },
      historyQueryCreateCommand.items
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
      items: [{}],
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
    expect(ctx.app.reloadService.onDeleteHistoryItem).toHaveBeenCalledWith('id', 'id1');

    expect(ctx.app.reloadService.onUpdateHistoryQuerySettings).toHaveBeenCalledWith('id', historyQueryCommand);
    expect(ctx.noContent).toHaveBeenCalled();
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
          id: 'id2',
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
        id: 'id',
        name: 'name',
        enabled: true,
        scanModeId: '',
        settings_field: 'value'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        scanModeId: '',
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
          name: 'item1'
        },
        {
          name: 'item2',
          settings_badField: 'badField'
        },
        {
          name: 'item3',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'item4',
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
            enabled: true,
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
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'newItem',
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

  it('checkImportSouthItems() should reject bad file type', async () => {
    ctx.params.southType = 'south-test';
    ctx.request.file = { path: 'myFile.txt', mimetype: 'bad type' };

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledTimes(1);
    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();
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
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateHistoryQueryItems.mockImplementation(() => {
      throw new Error('onCreateOrUpdateHistoryQueryItems error');
    });
    await historyQueryController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('onCreateOrUpdateHistoryQueryItems error');
  });

  it('importSouthItems() should import items', async () => {
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
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateHistoryQueryItems.mockImplementation(() => {
      return true;
    });
    await historyQueryController.importSouthItems(ctx);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });
});
