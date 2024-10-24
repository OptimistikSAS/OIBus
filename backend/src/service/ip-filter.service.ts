import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import { IPFilterCommandDTO, IPFilterDTO } from '../../shared/model/ip-filter.model';
import { IPFilter } from '../model/ip-filter.model';
import ProxyServer from '../web-server/proxy-server';

export default class IPFilterService {
  constructor(
    protected readonly validator: JoiValidator,
    private ipFilterRepository: IpFilterRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private proxyServer: ProxyServer
  ) {}

  findAll(): Array<IPFilter> {
    return this.ipFilterRepository.findAll();
  }

  findById(id: string): IPFilter | null {
    return this.ipFilterRepository.findById(id);
  }

  async create(command: IPFilterCommandDTO, webServerFilters: { whiteList: Array<string> }): Promise<IPFilter> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.ipFilterRepository.create(command);
    const ipFilters = this.ipFilterRepository.findAll().map(ip => ip.address);

    this.proxyServer.refreshIpFilters(ipFilters);
    webServerFilters.whiteList = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters];
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return ipFilter;
  }

  async update(id: string, command: IPFilterCommandDTO, webServerFilters: { whiteList: Array<string> }): Promise<void> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.ipFilterRepository.findById(id);
    if (!ipFilter) {
      throw new Error(`IP Filter ${id} not found`);
    }

    this.ipFilterRepository.update(id, command);

    const ipFilters = this.ipFilterRepository.findAll().map(ip => ip.address);
    this.proxyServer.refreshIpFilters(ipFilters);
    webServerFilters.whiteList = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters];
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(id: string, webServerFilters: { whiteList: Array<string> }): Promise<void> {
    const ipFilter = this.ipFilterRepository.findById(id);
    if (!ipFilter) {
      throw new Error(`IP Filter ${id} not found`);
    }

    this.ipFilterRepository.delete(id);
    const ipFilters = this.ipFilterRepository.findAll().map(ip => ip.address);
    this.proxyServer.refreshIpFilters(ipFilters);
    webServerFilters.whiteList = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters];
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}

export const toIPFilterDTO = (ipFilter: IPFilter): IPFilterDTO => {
  return {
    id: ipFilter.id,
    address: ipFilter.address,
    description: ipFilter.description
  };
};
