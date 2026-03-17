import { IPFilterController } from './ip-filter.controller';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import IPFilterServiceMock from '../../tests/__mocks__/service/ip-filter-service.mock';
import UserService from 'src/service/user.service';

// Mock the services
jest.mock('../../service/ip-filter.service', () => ({
  toIPFilterDTO: jest.fn().mockImplementation((ipFilter, getUserInfo) => {
    getUserInfo('');
    return ipFilter;
  })
}));

describe('IPFilterController', () => {
  let controller: IPFilterController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      ipFilterService: new IPFilterServiceMock(),
      userService: { getUserInfo: jest.fn().mockReturnValue({ id: 'test', friendlyName: 'Test' }) } as unknown as UserService
    },
    user: {
      id: 'test',
      login: 'testUser'
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IPFilterController();
  });

  it('should return a list of IP filters', async () => {
    const mockIPFilters = testData.ipFilters.list;
    (mockRequest.services!.ipFilterService.list as jest.Mock).mockReturnValue(mockIPFilters);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.ipFilterService.list).toHaveBeenCalled();
    expect(result).toEqual(mockIPFilters);
  });

  it('should return an IP filter by ID', async () => {
    const mockIPFilter = testData.ipFilters.list[0];
    const ipFilterId = mockIPFilter.id;
    (mockRequest.services!.ipFilterService.findById as jest.Mock).mockReturnValue(mockIPFilter);

    const result = await controller.findById(ipFilterId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.ipFilterService.findById).toHaveBeenCalledWith(ipFilterId);
    expect(result).toEqual(mockIPFilter);
  });

  it('should create a new IP filter', async () => {
    const command: IPFilterCommandDTO = testData.ipFilters.command;
    const createdIPFilter = testData.ipFilters.list[0];
    (mockRequest.services!.ipFilterService.create as jest.Mock).mockResolvedValue(createdIPFilter);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.ipFilterService.create).toHaveBeenCalledWith(command, 'test');
    expect(result).toEqual(createdIPFilter);
  });

  it('should update an existing IP filter', async () => {
    const ipFilterId = testData.ipFilters.list[0].id;
    const command: IPFilterCommandDTO = testData.ipFilters.command;
    (mockRequest.services!.ipFilterService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(ipFilterId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.ipFilterService.update).toHaveBeenCalledWith(ipFilterId, command, 'test');
  });

  it('should delete an IP filter', async () => {
    const ipFilterId = testData.ipFilters.list[0].id;
    (mockRequest.services!.ipFilterService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(ipFilterId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.ipFilterService.delete).toHaveBeenCalledWith(ipFilterId);
  });
});
