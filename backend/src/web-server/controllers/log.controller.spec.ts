import { LogController } from './log.controller';
import { LogSearchParam, Scope } from '../../../shared/model/logs.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import LogServiceMock from '../../tests/__mocks__/service/log-service.mock';
import { createPageFromArray } from '../../../shared/model/types';
import { DateTime } from 'luxon';

// Mock the services
jest.mock('../../service/log.service', () => ({
  toLogDTO: jest.fn().mockImplementation(log => log)
}));

describe('LogController', () => {
  let controller: LogController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      logService: new LogServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    controller = new LogController();
  });

  it('should return logs with search parameters', async () => {
    const page = 1;
    const start = testData.constants.dates.DATE_1;
    const end = testData.constants.dates.DATE_2;
    const levels = 'info,debug';
    const scopeTypes = 'south,north';
    const scopeIds = 'scope1,scope2';
    const messageContent = 'message';

    const searchParams: LogSearchParam = {
      page: 1,
      start: start,
      end: end,
      levels: ['info', 'debug'],
      scopeTypes: ['south', 'north'],
      scopeIds: ['scope1', 'scope2'],
      messageContent: messageContent
    };

    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    (mockRequest.services!.logService.search as jest.Mock).mockResolvedValue(expectedResult);

    const result = await controller.search(
      start,
      end,
      levels,
      scopeIds,
      scopeTypes,
      messageContent,
      page,
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.logService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should return logs with default search parameters', async () => {
    const now = DateTime.now();
    const dayAgo = now.minus({ days: 1 });

    const searchParams: LogSearchParam = {
      page: 0,
      start: dayAgo.toUTC().toISO(),
      end: testData.constants.dates.FAKE_NOW,
      levels: [],
      scopeTypes: [],
      scopeIds: [],
      messageContent: undefined
    };

    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    (mockRequest.services!.logService.search as jest.Mock).mockResolvedValue(expectedResult);

    const result = await controller.search(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.logService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should suggest scopes by name', async () => {
    const scopes: Array<Scope> = [{ scopeId: 'id', scopeName: 'name' }];
    const name = 'name';
    (mockRequest.services!.logService.suggestScopes as jest.Mock).mockReturnValue(scopes);

    const result = await controller.suggestScopes(name, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.logService.suggestScopes).toHaveBeenCalledWith(name);
    expect(result).toEqual(scopes);
  });

  it('should suggest scopes by name with default parameter', async () => {
    const scopes: Array<Scope> = [{ scopeId: 'id', scopeName: 'name' }];
    (mockRequest.services!.logService.suggestScopes as jest.Mock).mockReturnValue(scopes);

    const result = await controller.suggestScopes(undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.logService.suggestScopes).toHaveBeenCalledWith('');
    expect(result).toEqual(scopes);
  });

  it('should get scope by its ID', async () => {
    const scope: Scope = { scopeId: 'id', scopeName: 'name' };
    const scopeId = 'id';
    (mockRequest.services!.logService.getScopeById as jest.Mock).mockReturnValue(scope);

    const result = await controller.getScopeById(scopeId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.logService.getScopeById).toHaveBeenCalledWith(scopeId);
    expect(result).toEqual(scope);
  });
});
