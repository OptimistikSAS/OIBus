import HistoryQueryConnectorController from './history-query.controller';
import { northManifests } from './north-connector.controller';
import { southManifests } from './south-connector.controller';

import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from '../../validators/joi.validator';

jest.mock('../../validators/joi.validator');

const ctx = new KoaContextMock();
const validator = new JoiValidator();
const southConnectorController = new HistoryQueryConnectorController(validator, southManifests, northManifests);

const northCacheSettings = {
  scanModeId: 'scanModeId',
  retryInterval: 1000,
  retryCount: 3,
  groupCount: 100,
  maxSendCount: 1000,
  timeout: 10000
};
const northArchiveSettings = {
  enabled: true,
  retentionDuration: 1000
};
const historyQueryCommand = {
  name: 'name',
  description: 'description',
  enabled: true,
  startTime: 'startTime',
  endTime: 'endTime',
  southType: 'MQTT',
  northType: 'MQTT',
  southSettings: {
    key: 'value'
  },
  northSettings: {
    key: 'value'
  },
  caching: northCacheSettings,
  archive: northArchiveSettings
};
const historyQuery = {
  id: 'id',
  ...historyQueryCommand
};

describe('History query controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('getHistoryQueries() should return history queries', async () => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQueries.mockReturnValue([historyQuery]);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await southConnectorController.getHistoryQueries(ctx);

    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(
      1,
      historyQuery.southSettings,
      southManifests.find(south => south.name === historyQuery.southType)!.settings
    );
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(
      2,
      historyQuery.northSettings,
      northManifests.find(north => north.name === historyQuery.northType)!.settings
    );
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

    await southConnectorController.getHistoryQueries(ctx);
    expect(ctx.ok).toHaveBeenCalledWith([historyQuery, null]);
  });

  it('getHistoryQuery() should return history query', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(historyQuery);
    ctx.app.encryptionService.filterSecrets.mockReturnValueOnce(historyQuery.southSettings).mockReturnValueOnce(historyQuery.northSettings);

    await southConnectorController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(
      1,
      historyQuery.southSettings,
      southManifests.find(south => south.name === historyQuery.southType)!.settings
    );
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenNthCalledWith(
      2,
      historyQuery.northSettings,
      northManifests.find(north => north.name === historyQuery.northType)!.settings
    );
    expect(ctx.ok).toHaveBeenCalledWith(historyQuery);
  });

  it('getHistoryQuery() should return not found when history query is not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(null);

    await southConnectorController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it.each(invalidHistoryQueries)('getHistoryQuery() should return not found when history manifest not found', async invalidHistoryQuery => {
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery.mockReturnValue(invalidHistoryQuery);

    await southConnectorController.getHistoryQuery(ctx);

    expect(ctx.app.repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
