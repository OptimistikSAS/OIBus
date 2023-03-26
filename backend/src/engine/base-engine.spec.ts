import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';

import { OibusItemDTO } from '../../../shared/model/south-connector.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../service/repository.service';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import BaseEngine from './base-engine';
import ProxyService from '../service/proxy.service';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/proxy.service');
jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';

let engine: BaseEngine;
describe('BaseEngine', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    engine = new BaseEngine(encryptionService, proxyService, northService, southService, logger, 'cacheFolder');
  });

  it('it should log a warning on start', async () => {
    await engine.start();
    expect(logger.warn).toHaveBeenCalledWith(`start() should be surcharged`);
  });

  it('it should log a warning on stop', async () => {
    await engine.stop();
    expect(logger.warn).toHaveBeenCalledWith(`stop() should be surcharged`);
  });

  it('should properly change logger', async () => {
    engine.setLogger(anotherLogger);
    await engine.start();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(anotherLogger.warn).toHaveBeenCalledWith(`start() should be surcharged`);
  });
});
