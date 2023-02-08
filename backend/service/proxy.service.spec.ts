import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import ProxyService from './proxy.service';
import { ProxyDTO } from '../../shared/model/proxy.model';
import EncryptionService from './encryption.service';

const proxies: Array<ProxyDTO> = [
  {
    id: 'id1',
    name: 'proxy1',
    description: 'My Proxy 1',
    address: 'http://localhost:8080',
    username: 'user',
    password: 'pass1'
  },
  {
    id: 'id2',
    name: 'proxy2',
    description: 'My Proxy 3',
    address: 'https://localhost:8080',
    username: 'user',
    password: 'pass2'
  }
];
jest.mock('./encryption.service');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
let service: ProxyService;
describe('proxy service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProxyService(proxies, encryptionService);
  });

  it('should create proxy agent without user', async () => {
    const agent = await service.createProxyAgent('http://host:8080', null, null);

    expect(agent).toEqual({
      proxy: {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'host:8080',
        port: '8080',
        hostname: 'host',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://host:8080/'
      },
      proxyUri: 'http://host:8080',
      proxyFn: expect.any(Function)
    });
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
  });

  it('should create proxy agent with user', async () => {
    const agent = await service.createProxyAgent('http://host:8080', 'user', 'pass');

    expect(agent).toEqual({
      proxy: {
        auth: 'user:pass',
        protocol: 'http:',
        slashes: true,
        host: 'host:8080',
        port: '8080',
        hostname: 'host',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://host:8080/'
      },
      proxyUri: 'http://user:pass@host:8080',
      proxyFn: expect.any(Function)
    });
    expect(encryptionService.decryptText).toHaveBeenCalledWith('pass');
  });

  it('should get correct proxy agent', async () => {
    service.createProxyAgent = jest.fn().mockImplementation(() => ({ proxyAgent: 'a field' }));

    expect(await service.getProxy('proxy0')).toBeNull();

    expect(await service.getProxy('proxy1')).toEqual({ proxyAgent: 'a field' });
  });
});
