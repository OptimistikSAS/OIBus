import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionService from './encryption.service';
import NorthService from './north.service';
import RepositoryService from './repository.service';
import pino from 'pino';

import { NorthCacheSettingsDTO } from '../../../shared/model/north-connector.model';

jest.mock('./encryption.service');
jest.mock('./north-connector-metrics.service');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock('', '');

const logger: pino.Logger = new PinoLogger();
let service: NorthService;
describe('north service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new NorthService(encryptionService, repositoryService);
  });

  it('should get a North connector settings', () => {
    service.getNorth('northId');
    expect(repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledTimes(1);
    expect(repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('northId');
  });

  it('should get all North connector settings', () => {
    service.getNorthList();
    expect(repositoryService.northConnectorRepository.getNorthConnectors).toHaveBeenCalledTimes(1);
  });

  it('should create North connector', () => {
    const connector = service.createNorth(
      {
        id: 'northId',
        name: 'myNorth',
        description: 'my test connector',
        type: 'console',
        enabled: false,
        caching: {
          oibusTimeValues: {},
          rawFiles: {
            archive: {}
          }
        } as NorthCacheSettingsDTO,
        settings: { verbose: true }
      },
      'myBaseFolder',
      logger
    );
    expect(connector).toBeDefined();
  });

  it('should not create North connector not installed', () => {
    let connector;
    let error;
    try {
      connector = service.createNorth(
        {
          id: 'northId',
          name: 'myNorth',
          description: 'my test connector',
          type: 'another',
          enabled: false,
          caching: {
            oibusTimeValues: {},
            rawFiles: {
              archive: {}
            }
          } as NorthCacheSettingsDTO,
          settings: { verbose: true }
        },
        'myBaseFolder',
        logger
      );
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('North connector of type another not installed'));
    expect(connector).not.toBeDefined();
  });

  it('should retrieve a list of north manifest', () => {
    const list = service.getInstalledNorthManifests();
    expect(list).toBeDefined();
  });
});
