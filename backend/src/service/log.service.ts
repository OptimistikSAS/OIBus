import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { Page } from '../../shared/model/types';
import { OIBusLog } from '../model/logs.model';
import { LogDTO, LogSearchParam, Scope } from '../../shared/model/logs.model';
import LogRepository from '../repository/logs/log.repository';

export default class LogService {
  constructor(
    protected readonly validator: JoiValidator,
    private logRepository: LogRepository
  ) {}

  search(searchParams: LogSearchParam): Page<OIBusLog> {
    return this.logRepository.search(searchParams);
  }

  searchScopesByName(name: string): Array<Scope> {
    return this.logRepository.searchScopesByName(name);
  }

  getScopeById(scopeId: string): Scope | null {
    return this.logRepository.getScopeById(scopeId);
  }
}

export const toLogDTO = (log: OIBusLog): LogDTO => {
  return {
    timestamp: log.timestamp,
    level: log.level,
    scopeType: log.scopeType,
    scopeId: log.scopeId,
    scopeName: log.scopeName,
    message: log.message
  };
};
