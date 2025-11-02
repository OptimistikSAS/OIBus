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

  list(): Array<IPFilter> {
    return this.ipFilterRepository.list();
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
      this.ipFilterRepository.list().map(ip => ip.address)
    );
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return ipFilter;
  }

  async update(ipFilterId: string, command: IPFilterCommandDTO): Promise<void> {
    await this.validator.validate(ipFilterSchema, command);
    const ipFilter = this.findById(ipFilterId);
    this.ipFilterRepository.update(ipFilter.id, command);
    this.whiteListEvent.emit(
      'update-white-list',
      this.ipFilterRepository.list().map(ip => ip.address)
    );
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(ipFilterId: string): Promise<void> {
    const ipFilter = this.findById(ipFilterId);
    this.ipFilterRepository.delete(ipFilter.id);
    this.whiteListEvent.emit(
      'update-white-list',
      this.ipFilterRepository.list().map(ip => ip.address)
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
