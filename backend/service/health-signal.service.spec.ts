import HealthSignalService from './health-signal-service';

import { HealthSignalDTO } from '../../shared/model/engine.model';
import ProxyRepository from '../repository/proxy.repository';
import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';

jest.mock('./utils');

let service: HealthSignalService;
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const proxyService: ProxyService = new ProxyService({} as ProxyRepository, encryptionService);
const logger: pino.Logger = new PinoLogger();

describe('HealthSignal service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  it('without signals enabled should not init timers', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const settings: HealthSignalDTO = {
      logging: {
        enabled: false,
        interval: 60
      },
      http: {
        enabled: false,
        interval: 60,
        address: 'http://localhost:2223',
        proxyId: null,
        authentication: {
          type: 'none'
        },
        verbose: true
      }
    };
    service = new HealthSignalService(settings, proxyService, encryptionService, logger);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    await service.stop();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('with signals enabled should init timers', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const settings: HealthSignalDTO = {
      logging: {
        enabled: true,
        interval: 60
      },
      http: {
        enabled: true,
        interval: 60,
        address: 'http://localhost:2223',
        proxyId: null,
        authentication: {
          type: 'none'
        },
        verbose: true
      }
    };
    service = new HealthSignalService(settings, proxyService, encryptionService, logger);

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });
});
