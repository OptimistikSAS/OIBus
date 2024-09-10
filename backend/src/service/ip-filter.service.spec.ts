import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IPFilterService from './ip-filter.service';
import IpFilterRepository from '../repository/ip-filter.repository';
import IpFilterRepositoryMock from '../tests/__mocks__/repository/ip-filter-repository.mock';
import ProxyServer from '../web-server/proxy-server';
import ProxyServerMock from '../tests/__mocks__/proxy-server.mock';
import testData from '../tests/utils/test-data';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const ipFilterRepository: IpFilterRepository = new IpFilterRepositoryMock();
const proxyServer: ProxyServer = new ProxyServerMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: IPFilterService;
describe('IP Filter Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new IPFilterService(validator, ipFilterRepository, oIAnalyticsMessageService, proxyServer);
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

    const result = await service.create(testData.ipFilters.command, { whiteList: [] });

    expect(validator.validate).toHaveBeenCalledWith(ipFilterSchema, testData.ipFilters.command);
    expect(proxyServer.refreshIpFilters).toHaveBeenCalledWith(testData.ipFilters.list.map(ip => ip.address));
    expect(oIAnalyticsMessageService.createFullConfigMessage).toHaveBeenCalled();
    expect(result).toEqual(testData.ipFilters.list[0]);
  });

  it('update() should update an ip filter', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    await service.update(testData.ipFilters.list[0].id, testData.ipFilters.command, { whiteList: [] });

    expect(validator.validate).toHaveBeenCalledWith(ipFilterSchema, testData.ipFilters.command);
    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.findAll).toHaveBeenCalled();
    expect(ipFilterRepository.update).toHaveBeenCalledWith(testData.ipFilters.list[0].id, testData.ipFilters.command);
    expect(proxyServer.refreshIpFilters).toHaveBeenCalledWith(testData.ipFilters.list.map(ip => ip.address));
    expect(oIAnalyticsMessageService.createFullConfigMessage).toHaveBeenCalled();
  });

  it('update() should not update if the ip filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.ipFilters.list[0].id, testData.ipFilters.command, { whiteList: [] })).rejects.toThrow(
      new Error(`IP Filter ${testData.ipFilters.list[0].id} not found`)
    );

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.update).not.toHaveBeenCalled();
    expect(proxyServer.refreshIpFilters).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessage).not.toHaveBeenCalled();
  });

  it('delete() should delete an ip filter', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(testData.ipFilters.list[0]);
    (ipFilterRepository.findAll as jest.Mock).mockReturnValueOnce(testData.ipFilters.list);

    await service.delete(testData.ipFilters.list[0].id, { whiteList: [] });

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.delete).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(proxyServer.refreshIpFilters).toHaveBeenCalledWith(testData.ipFilters.list.map(ip => ip.address));
    expect(oIAnalyticsMessageService.createFullConfigMessage).toHaveBeenCalled();
  });

  it('delete() should not delete if the IP Filter is not found', async () => {
    (ipFilterRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.ipFilters.list[0].id, { whiteList: [] })).rejects.toThrow(
      new Error(`IP Filter ${testData.ipFilters.list[0].id} not found`)
    );

    expect(ipFilterRepository.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ipFilterRepository.delete).not.toHaveBeenCalled();
    expect(proxyServer.refreshIpFilters).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessage).not.toHaveBeenCalled();
  });
});
