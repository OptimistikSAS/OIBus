import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { Page } from '../../shared/model/types';
import { OIBusLog } from '../model/logs.model';
import { Item, LogDTO, LogSearchParam, Scope } from '../../shared/model/logs.model';
import LogRepository from '../repository/logs/log.repository';
import { NotFoundError } from '../model/types';

export default class LogService {
  constructor(
    protected readonly validator: JoiValidator,
    private logRepository: LogRepository
  ) {}

  search(searchParams: LogSearchParam): Page<OIBusLog> {
    return this.logRepository.search(searchParams);
  }

  suggestScopes(name: string): Array<Scope> {
    return this.logRepository.suggestScopes(name);
  }

  getScopeById(scopeId: string): Scope {
    const scope = this.logRepository.getScopeById(scopeId);
    if (!scope) {
      throw new NotFoundError(`Scope "${scopeId}" not found`);
    }
    return scope;
  }

  suggestItems(name: string): Array<Item> {
    return this.logRepository.suggestItems(name);
  }

  getItemById(itemId: string): Item {
    const item = this.logRepository.getItemById(itemId);
    if (!item) {
      throw new NotFoundError(`Item "${itemId}" not found`);
    }
    return item;
  }
}

export const toLogDTO = (log: OIBusLog): LogDTO => {
  return {
    timestamp: log.timestamp,
    level: log.level,
    scopeType: log.scopeType,
    scopeId: log.scopeId,
    scopeName: log.scopeName,
    itemId: log.itemId,
    itemName: log.itemName,
    message: log.message
  };
};
