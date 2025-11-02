import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IPFilterService, { toIPFilterDTO } from './ip-filter.service';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import IpFilterRepositoryMock from '../tests/__mocks__/repository/config/ip-filter-repository.mock';
import testData from '../tests/utils/test-data';
import { NotFoundError } from '../model/types';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const ipFilterRepository: IpFilterRepository = new IpFilterRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: IPFilterService;
describe('IP Filter Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new IPFilterService(validator, ipFilterRepository, oIAnalyticsMessageService);
  });

  it('should list all ip filters', () => {
    (ipFilterRepository.list as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    const result = service.list();

    expect(ipFilterRepository.list).toHaveBeenCalled();
    expect(result).toEqual(testData.ipFilters.list);
  });

  it('should find an ip filter by id', () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);

    const result = service.findById(testData.ipFilters.list[0].id);

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(result).toEqual(testData.ipFilters.list[0]);
  });

  it('should not get if the ip filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findById(testData.ipFilters.list[0].id)).toThrow(
      new NotFoundError(`IP filter "${testData.ipFilters.list[0].id}" not found`)
    );
    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
  });

  it('should create an ip filter', async () => {
    (ipFilterRepository.create as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.list as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    const result = await service.create(testData.ipFilters.command);

    expect(validator.validate).toHaveBeenCalledWith(ipFilterSchema, testData.ipFilters.command);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(result).toEqual(testData.ipFilters.list[0]);
  });

  it('should update an ip filter', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.list as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    await service.update(testData.ipFilters.list[0].id, testData.ipFilters.command);

    expect(validator.validate).toHaveBeenCalledWith(ipFilterSchema, testData.ipFilters.command);
    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.list).toHaveBeenCalled();
    expect(ipFilterRepository.update).toHaveBeenCalledWith(testData.ipFilters.list[0].id, testData.ipFilters.command);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should not update if the ip filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.ipFilters.list[0].id, testData.ipFilters.command)).rejects.toThrow(
      new NotFoundError(`IP filter "${testData.ipFilters.list[0].id}" not found`)
    );

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.update).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should delete an ip filter', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.list as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    await service.delete(testData.ipFilters.list[0].id);

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.delete).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should not delete if the IP filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.ipFilters.list[0].id)).rejects.toThrow(
      new NotFoundError(`IP filter "${testData.ipFilters.list[0].id}" not found`)
    );

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.delete).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should properly convert to DTO', () => {
    const ipFilter = testData.ipFilters.list[0];
    expect(toIPFilterDTO(ipFilter)).toEqual({
      id: ipFilter.id,
      address: ipFilter.address,
      description: ipFilter.description
    });
  });
});
