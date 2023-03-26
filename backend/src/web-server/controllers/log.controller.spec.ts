import logController from './log.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

const ctx = new KoaContextMock();
const logStreamValuesCommand = {
  values: [[`${1000000 * Date.now()}`, 'message']],
  stream: {
    level: 'info',
    oibus: 'oibus',
    scope: 'scope'
  }
};
const logStreamCommand = {
  streams: [logStreamValuesCommand]
};
const formattedLog = {
  oibus: logStreamValuesCommand.stream.oibus,
  time: new Date(parseInt(logStreamValuesCommand.values[0][0]) / 1000000),
  scope: logStreamValuesCommand.stream.scope,
  msg: logStreamValuesCommand.values[0][1]
};
const log = {
  timestamp: formattedLog.time.toISOString(),
  level: logStreamValuesCommand.stream.level,
  scope: formattedLog.scope,
  message: formattedLog.msg
};
const page = {
  content: [log],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};
const nowDateString = '2020-02-02T02:02:02.222Z';

describe('Log controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  it('searchLogs() should return logs', async () => {
    ctx.query.levels = ['info'];
    ctx.query.page = 1;
    ctx.query.start = '2023-03-01T00:00:00.000Z';
    ctx.query.end = '2023-03-31T00:00:00.000Z';
    ctx.query.scope = 'scope';
    ctx.query.messageContent = 'message';
    const searchParams = {
      page: 1,
      start: '2023-03-01T00:00:00.000Z',
      end: '2023-03-31T00:00:00.000Z',
      levels: ['info'],
      scope: 'scope',
      messageContent: 'message'
    };
    ctx.app.repositoryService.logRepository.searchLogs.mockReturnValue(page);

    await logController.searchLogs(ctx);

    expect(ctx.app.repositoryService.logRepository.searchLogs).toHaveBeenCalledWith(searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchLogs() should return logs with default search params', async () => {
    ctx.query = {
      levels: 'info'
    };
    const searchParams = {
      page: 0,
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date().toISOString(),
      levels: ['info'],
      scope: null,
      messageContent: null
    };
    ctx.app.repositoryService.logRepository.searchLogs.mockReturnValue(page);

    await logController.searchLogs(ctx);

    expect(ctx.app.repositoryService.logRepository.searchLogs).toHaveBeenCalledWith(searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  const levels: string[] = ['trace', 'debug', 'info', 'warn', 'error'];
  it.each(levels)(`addLogs() should %p log`, async level => {
    ctx.request.body = logStreamCommand;
    ctx.request.body.streams[0].stream.level = level;

    await logController.addLogs(ctx);

    expect(ctx.app.logger[level]).toHaveBeenCalledWith(formattedLog);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('addLogs() should return bad request', async () => {
    ctx.request.body = undefined;
    ctx.app.repositoryService.logRepository.searchLogs.mockReturnValue(page);

    await logController.addLogs(ctx);

    expect(ctx.app.logger.trace).not.toHaveBeenCalled();
    expect(ctx.app.logger.debug).not.toHaveBeenCalled();
    expect(ctx.app.logger.info).not.toHaveBeenCalled();
    expect(ctx.app.logger.warn).not.toHaveBeenCalled();
    expect(ctx.app.logger.error).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });
});
