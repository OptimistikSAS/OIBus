import RepositoryServiceMock from './repository-service.mock';
import ReloadServiceMock from './reload-service.mock';
import EncryptionServiceMock from './encryption-service.mock';
import NorthServiceMock from './north-service.mock';
import SouthServiceMock from './south-service.mock';
import OIBusServiceMock from './oibus-service.mock';

/**
 * Create a mock object for Koa Context
 */
export default jest.fn().mockImplementation(() => ({
  app: {
    repositoryService: new RepositoryServiceMock(),
    reloadService: new ReloadServiceMock(),
    encryptionService: new EncryptionServiceMock(),
    northService: new NorthServiceMock(),
    southService: new SouthServiceMock(),
    oibusService: new OIBusServiceMock(),
    logger: {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  },
  request: {},
  params: {},
  query: {},
  ok: jest.fn(),
  created: jest.fn(),
  noContent: jest.fn(),
  badRequest: jest.fn(),
  notFound: jest.fn(),
  throw: jest.fn()
}));
