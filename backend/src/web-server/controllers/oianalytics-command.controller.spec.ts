import { OIAnalyticsCommandController } from './oianalytics-command.controller';
import { CommandSearchParam } from '../../../shared/model/command.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import OIAnalyticsCommandServiceMock from '../../tests/__mocks__/service/oia/oianalytics-command-service.mock';
import { createPageFromArray } from '../../../shared/model/types';

// Mock the services
jest.mock('../../service/oia/oianalytics-command.service', () => ({
  toOIBusCommandDTO: jest.fn().mockImplementation(command => command)
}));

describe('OIAnalyticsCommandController', () => {
  let controller: OIAnalyticsCommandController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      oIAnalyticsCommandService: new OIAnalyticsCommandServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OIAnalyticsCommandController();
  });

  it('should return commands with search parameters', async () => {
    const types = 'update-version,restart-engine';
    const status = 'ERRORED,RETRIEVED';
    const page = 1;
    const start = testData.constants.dates.DATE_1;
    const end = testData.constants.dates.DATE_2;
    const ack = true;

    const searchParams: CommandSearchParam = {
      types: ['update-version', 'restart-engine'],
      status: ['ERRORED', 'RETRIEVED'],
      page: 1,
      start,
      end,
      ack
    };

    const expectedResult = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 1);
    (mockRequest.services!.oIAnalyticsCommandService.search as jest.Mock).mockReturnValue(expectedResult);

    const result = await controller.search(types, status, start, end, ack, page, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsCommandService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should return commands with default search parameters', async () => {
    const searchParams: CommandSearchParam = {
      types: [],
      status: [],
      page: 0,
      start: undefined,
      end: undefined,
      ack: undefined
    };

    const expectedResult = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 0);
    (mockRequest.services!.oIAnalyticsCommandService.search as jest.Mock).mockReturnValue(expectedResult);

    const result = await controller.search(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.oIAnalyticsCommandService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should delete a command', async () => {
    const commandId = 'id';
    (mockRequest.services!.oIAnalyticsCommandService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(commandId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsCommandService.delete).toHaveBeenCalledWith(commandId);
  });
});
