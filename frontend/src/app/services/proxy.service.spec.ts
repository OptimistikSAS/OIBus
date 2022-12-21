import { TestBed } from '@angular/core/testing';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProxyService } from './proxy.service';
import { ProxyCommandDTO, ProxyDTO } from '../model/proxy.model';

describe('ProxyService', () => {
  let http: HttpTestingController;
  let service: ProxyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProxyService]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProxyService);
  });

  afterEach(() => http.verify());

  it('should get all proxies', () => {
    let expectedProxies: Array<ProxyDTO> = [];
    service.getProxies().subscribe(proxies => (expectedProxies = proxies));

    http.expectOne('/api/proxies').flush([{ name: 'Proxy 1' }, { name: 'Proxy 2' }]);

    expect(expectedProxies.length).toBe(2);
  });

  it('should get a proxy', () => {
    let expectedProxy: ProxyDTO | null = null;
    const proxy = { id: 'id1' } as ProxyDTO;

    service.getProxy('id1').subscribe(c => (expectedProxy = c));

    http.expectOne({ url: '/api/proxies/id1', method: 'GET' }).flush(proxy);
    expect(expectedProxy!).toEqual(proxy);
  });

  it('should create a proxy', () => {
    let done = false;
    const command: ProxyCommandDTO = {
      name: 'myProxy',
      description: 'a test proxy',
      address: 'http://localhost',
      username: 'a user',
      password: 'a password'
    };

    service.createProxy(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/proxies' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a proxy', () => {
    let done = false;
    const command: ProxyCommandDTO = {
      name: 'myProxy',
      description: 'a test proxy',
      address: 'http://localhost',
      username: 'a user',
      password: 'a password'
    };

    service.updateProxy('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/proxies/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a proxy', () => {
    let done = false;
    service.deleteProxy('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/proxies/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
