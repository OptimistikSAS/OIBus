import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { logSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import { createPageFromArray } from '../../shared/model/types';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import LogService from './log.service';
import { DateTime } from 'luxon';
import { LogSearchParam } from '../../shared/model/logs.model';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const logRepository: LogRepository = new LogRepositoryMock();
const logger: pino.Logger = new PinoLogger();

let service: LogService;
describe('Log Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new LogService(validator, logRepository);
  });

  it('search() should search logs', () => {
    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    (logRepository.search as jest.Mock).mockReturnValueOnce(expectedResult);

    const searchParams: LogSearchParam = {
      page: 0,
      start: DateTime.now().minus({ days: 1 }).toUTC().toISO(),
      end: DateTime.now().toUTC().toISO(),
      levels: [],
      scopeIds: [],
      scopeTypes: [],
      messageContent: null
    };
    const result = service.search(searchParams);

    expect(logRepository.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual(expectedResult);
  });

  it('searchScopesByName() should find a scope', () => {
    (logRepository.searchScopesByName as jest.Mock).mockReturnValueOnce([]);

    const result = service.searchScopesByName('scopeName');

    expect(logRepository.searchScopesByName).toHaveBeenCalledWith('scopeName');
    expect(result).toEqual([]);
  });

  it('getScopeById() should find a scope', () => {
    (logRepository.getScopeById as jest.Mock).mockReturnValueOnce({ scopeId: 'scopeId', scopeName: 'scopeName' });

    const result = service.getScopeById('scopeId');

    expect(logRepository.getScopeById).toHaveBeenCalledWith('scopeId');
    expect(result).toEqual({ scopeId: 'scopeId', scopeName: 'scopeName' });
  });
});
