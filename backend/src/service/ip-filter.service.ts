import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import { IPFilterCommandDTO, IPFilterDTO } from '../../shared/model/ip-filter.model';
import { IPFilter } from '../model/ip-filter.model';
import { EventEmitter } from 'node:events';

export default class IPFilterService {
  public whiteListEvent: EventEmitter = new EventEmitter(); // Used to trigger white list for Proxy server and Web server

  constructor(
    protected readonly validator: JoiValidator,
    private ipFilterRepository: IpFilterRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService
  ) {}

  findAll(): Array<IPFilter> {
    return this.ipFilterRepository.findAll();
  }

  findById(id: string): IPFilter | null {
    return this.ipFilterRepository.findById(id);
  }

  async create(command: IPFilterCommandDTO): Promise<IPFilter> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.ipFilterRepository.create(command);
    const ipFilters = this.ipFilterRepository.findAll().map(ip => ip.address);

    this.whiteListEvent.emit('update-white-list', ipFilters);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return ipFilter;
  }

  async update(id: string, command: IPFilterCommandDTO): Promise<void> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.ipFilterRepository.findById(id);
    if (!ipFilter) {
      throw new Error(`IP Filter ${id} not found`);
    }

    this.ipFilterRepository.update(id, command);

    const ipFilters = this.ipFilterRepository.findAll().map(ip => ip.address);
    this.whiteListEvent.emit('update-white-list', ipFilters);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(id: string): Promise<void> {
    const ipFilter = this.ipFilterRepository.findById(id);
    if (!ipFilter) {
      throw new Error(`IP Filter ${id} not found`);
    }

    this.ipFilterRepository.delete(id);
    const ipFilters = this.ipFilterRepository.findAll().map(ip => ip.address);
    this.whiteListEvent.emit('update-white-list', ipFilters);
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
