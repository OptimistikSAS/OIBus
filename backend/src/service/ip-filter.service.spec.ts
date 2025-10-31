import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IPFilterService from './ip-filter.service';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import IpFilterRepositoryMock from '../tests/__mocks__/repository/config/ip-filter-repository.mock';
import testData from '../tests/utils/test-data';

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

  it('findAll() should find all ip filters', () => {
    (ipFilterRepository.findAll as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    const result = service.findAll();

    expect(ipFilterRepository.findAll).toHaveBeenCalled();
    expect(result).toEqual(testData.ipFilters.list);
  });

  it('findById() should find an ip filter by id', () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);

    const result = service.findById(testData.ipFilters.list[0].id);

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(result).toEqual(testData.ipFilters.list[0]);
  });

  it('create() should create an ip filter', async () => {
    (ipFilterRepository.create as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    const result = await service.create(testData.ipFilters.command);

    expect(validator.validate).toHaveBeenCalledWith(ipFilterSchema, testData.ipFilters.command);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(result).toEqual(testData.ipFilters.list[0]);
  });

  it('update() should update an ip filter', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    await service.update(testData.ipFilters.list[0].id, testData.ipFilters.command);

    expect(validator.validate).toHaveBeenCalledWith(ipFilterSchema, testData.ipFilters.command);
    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.findAll).toHaveBeenCalled();
    expect(ipFilterRepository.update).toHaveBeenCalledWith(testData.ipFilters.list[0].id, testData.ipFilters.command);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('update() should not update if the ip filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.ipFilters.list[0].id, testData.ipFilters.command)).rejects.toThrow(
      new Error(`IP filter "${testData.ipFilters.list[0].id}" not found`)
    );

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.update).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should delete an ip filter', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    await service.delete(testData.ipFilters.list[0].id);

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.delete).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('delete() should not delete if the IP Filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.ipFilters.list[0].id)).rejects.toThrow(
      new Error(`IP filter "${testData.ipFilters.list[0].id}" not found`)
    );

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.delete).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });
});
