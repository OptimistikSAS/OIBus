import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { logSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import { Page } from '../../shared/model/types';
import { OIBusLog } from '../model/logs.model';
import { LogDTO, LogSearchParam, LogStreamCommandDTO, Scope } from '../../shared/model/logs.model';
import LogRepository from '../repository/logs/log.repository';
import pino from 'pino';

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

  async addLogsFromRemote(command: LogStreamCommandDTO, logger: pino.Logger): Promise<void> {
    await this.validator.validate(logSchema, command);
    command.streams.forEach(myStream => {
      myStream?.values.forEach(value => {
        const formattedLog = {
          oibus: myStream.stream.oibus,
          time: new Date(parseInt(value[0]) / 1000000),
          scopeType: myStream.stream.scopeType,
          scopeId: myStream.stream.scopeId,
          scopeName: myStream.stream.scopeName,
          msg: value[1]
        };
        switch (myStream.stream.level) {
          case 'trace':
            logger.trace(formattedLog);
            break;

          case 'debug':
            logger.debug(formattedLog);
            break;

          case 'info':
            logger.info(formattedLog);
            break;

          case 'warn':
            logger.warn(formattedLog);
            break;

          case 'error':
            logger.error(formattedLog);
            break;
        }
      });
    });
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
