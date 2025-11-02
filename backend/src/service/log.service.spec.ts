import JoiValidator from '../web-server/controllers/validators/joi.validator';
import testData from '../tests/utils/test-data';
import { createPageFromArray } from '../../shared/model/types';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import LogService, { toLogDTO } from './log.service';
import { DateTime } from 'luxon';
import { LogSearchParam } from '../../shared/model/logs.model';
import { NotFoundError } from '../model/types';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const logRepository: LogRepository = new LogRepositoryMock();

let service: LogService;
describe('Log Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new LogService(validator, logRepository);
  });

  it('should search logs', () => {
    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    (logRepository.search as jest.Mock).mockReturnValueOnce(expectedResult);

    const searchParams: LogSearchParam = {
      page: 0,
      start: DateTime.now().minus({ days: 1 }).toUTC().toISO(),
      end: DateTime.now().toUTC().toISO(),
      levels: [],
      scopeIds: [],
      scopeTypes: [],
      messageContent: undefined
    };
    const result = service.search(searchParams);

    expect(logRepository.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual(expectedResult);
  });

  it('should suggest scopes', () => {
    (logRepository.suggestScopes as jest.Mock).mockReturnValueOnce([]);

    const result = service.suggestScopes('scopeName');

    expect(logRepository.suggestScopes).toHaveBeenCalledWith('scopeName');
    expect(result).toEqual([]);
  });

  it('should get a scope', () => {
    (logRepository.getScopeById as jest.Mock).mockReturnValueOnce({ scopeId: 'scopeId', scopeName: 'scopeName' });

    const result = service.getScopeById('scopeId');

    expect(logRepository.getScopeById).toHaveBeenCalledWith('scopeId');
    expect(result).toEqual({ scopeId: 'scopeId', scopeName: 'scopeName' });
  });

  it('should not get if the scope is not found', async () => {
    (logRepository.getScopeById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.getScopeById('scopeId')).toThrow(new NotFoundError(`Scope "scopeId" not found`));
    expect(logRepository.getScopeById).toHaveBeenCalledWith('scopeId');
  });

  it('should properly convert to DTO', () => {
    const log = testData.logs.list[0];
    expect(toLogDTO(log)).toEqual({
      timestamp: log.timestamp,
      level: log.level,
      scopeType: log.scopeType,
      scopeId: log.scopeId,
      scopeName: log.scopeName,
      message: log.message
    });
  });
});
