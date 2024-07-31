import OIBusService from './oibus.service';
import OIBusEngine from '../engine/oibus-engine';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import { createProxyAgent } from './proxy-agent';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('./utils');
jest.mock('./proxy-agent');

const oibusEngine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();
const logger: pino.Logger = new PinoLogger();

const nowDateString = '2020-02-02T02:02:02.222Z';

let service: OIBusService;
describe('OIBus service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);

    service = new OIBusService(oibusEngine, historyQueryEngine);
  });

  it('should restart OIBus', async () => {
    await service.restartOIBus();
    expect(oibusEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.start).toHaveBeenCalled();
    expect(oibusEngine.start).toHaveBeenCalled();
  });

  it('should stop OIBus', async () => {
    await service.stopOIBus();
    expect(oibusEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
  });

  it('should add content', async () => {
    await service.addExternalContent('northId', { type: 'time-values', content: [] });
    expect(oibusEngine.addExternalContent).toHaveBeenCalledWith('northId', { type: 'time-values', content: [] });
  });

  it('should set logger', () => {
    service.setLogger(logger);
    expect(oibusEngine.setLogger).toHaveBeenCalledWith(logger);
    expect(historyQueryEngine.setLogger).toHaveBeenCalledWith(logger);
  });
});
