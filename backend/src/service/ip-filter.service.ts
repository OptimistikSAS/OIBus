import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import { IPFilterCommandDTO, IPFilterDTO } from '../../shared/model/ip-filter.model';
import { IPFilter } from '../model/ip-filter.model';
import { EventEmitter } from 'node:events';
import { NotFoundError } from '../model/types';

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

  findById(ipFilterId: string): IPFilter {
    const ipFilter = this.ipFilterRepository.findById(ipFilterId);
    if (!ipFilter) {
      throw new NotFoundError(`IP filter "${ipFilterId}" not found`);
    }
    return ipFilter;
  }

  async create(command: IPFilterCommandDTO): Promise<IPFilter> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.ipFilterRepository.create(command);
    this.whiteListEvent.emit(
      'update-white-list',
      this.ipFilterRepository.findAll().map(ip => ip.address)
    );
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return ipFilter;
  }

  async update(ipFilterId: string, command: IPFilterCommandDTO): Promise<void> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.ipFilterRepository.findById(ipFilterId);
    if (!ipFilter) {
      throw new NotFoundError(`IP filter "${ipFilterId}" not found`);
    }
    this.ipFilterRepository.update(ipFilterId, command);
    this.whiteListEvent.emit(
      'update-white-list',
      this.ipFilterRepository.findAll().map(ip => ip.address)
    );
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(ipFilterId: string): Promise<void> {
    const ipFilter = this.ipFilterRepository.findById(ipFilterId);
    if (!ipFilter) {
      throw new NotFoundError(`IP filter "${ipFilterId}" not found`);
    }
    this.ipFilterRepository.delete(ipFilterId);
    this.whiteListEvent.emit(
      'update-white-list',
      this.ipFilterRepository.findAll().map(ip => ip.address)
    );
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
