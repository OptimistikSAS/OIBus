import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import ProxyService from './proxy.service';
import { ProxyDTO } from '../../shared/model/proxy.model';
import EncryptionService from './encryption.service';
import ProxyRepository from '../repository/proxy.repository';
import { Database } from 'better-sqlite3';

jest.mock('../repository/proxy.repository');
jest.mock('./encryption.service');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const proxyRepository: ProxyRepository = new ProxyRepository({} as Database);
let service: ProxyService;
describe('proxy service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProxyService(proxyRepository, encryptionService);
  });

  it('should create proxy agent without user', async () => {
    const proxy: ProxyDTO = {
      id: 'id1',
      name: 'proxy1',
      description: 'My Proxy 1',
      address: 'http://localhost:8080',
      username: '',
      password: ''
    };
    proxyRepository.getProxy = jest.fn().mockReturnValue(proxy);

    const agent = await service.createProxyAgent('id1');
    expect(agent).toEqual({
      proxy: {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'localhost:8080',
        port: '8080',
        hostname: 'localhost',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://localhost:8080/'
      },
      proxyUri: 'http://localhost:8080',
      proxyFn: expect.any(Function)
    });
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
  });

  it('should create proxy agent with user', async () => {
    const proxy: ProxyDTO = {
      id: 'id1',
      name: 'proxy1',
      description: 'My Proxy 1',
      address: 'http://localhost:8080',
      username: 'user',
      password: 'pass'
    };
    proxyRepository.getProxy = jest.fn().mockReturnValue(proxy);

    const agent = await service.createProxyAgent('id1');
    expect(agent).toEqual({
      proxy: {
        auth: 'user:pass',
        protocol: 'http:',
        slashes: true,
        host: 'localhost:8080',
        port: '8080',
        hostname: 'localhost',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://localhost:8080/'
      },
      proxyUri: 'http://user:pass@localhost:8080',
      proxyFn: expect.any(Function)
    });
    expect(encryptionService.decryptText).toHaveBeenCalledWith('pass');
  });

  it('should return null if proxy not found', async () => {
    proxyRepository.getProxy = jest.fn().mockReturnValue(null);

    const agent = await service.createProxyAgent('id1');
    expect(agent).toEqual(null);
  });
});
